param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$localEnvRoot = Join-Path $root "local-env"
$bundledToolingRoot = if ($env:BONVOY_TOOLING_ROOT) {
    [System.IO.Path]::GetFullPath($env:BONVOY_TOOLING_ROOT)
} else {
    Join-Path $localEnvRoot "tooling"
}

if (-not (Test-Path -LiteralPath $bundledToolingRoot) -and (Test-Path -LiteralPath (Join-Path $root "tooling"))) {
    $bundledToolingRoot = Join-Path $root "tooling"
}

$useBundledToolchain = Test-Path -LiteralPath $bundledToolingRoot
if ($useBundledToolchain) {
    $javaHome = Join-Path $bundledToolingRoot "jdk\jdk-17.0.2"
    $gradle = Join-Path $bundledToolingRoot "gradle\gradle-8.9\bin\gradle.bat"
    $sdkRoot = Join-Path $bundledToolingRoot "android-sdk"
} else {
    $javaHome = $env:JAVA_HOME
    $sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
    $wrapper = Join-Path $root "gradlew.bat"
    $gradle = if (Test-Path -LiteralPath $wrapper) {
        $wrapper
    } else {
        (Get-Command gradle -ErrorAction Stop).Source
    }
}

if (-not $sdkRoot) {
    throw "未找到 Android SDK。请设置 ANDROID_HOME，或把工具链放入 local-env/tooling。"
}

$buildTools = Join-Path $sdkRoot "build-tools\35.0.0"
if (-not (Test-Path -LiteralPath $buildTools)) {
    $buildTools = Get-ChildItem -LiteralPath (Join-Path $sdkRoot "build-tools") -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name |
        Select-Object -Last 1 -ExpandProperty FullName
}
$releaseDir = Join-Path $root "app\build\outputs\apk\release"
$signedSource = Join-Path $releaseDir "app-release.apk"
$unsignedSource = Join-Path $releaseDir "app-release-unsigned.apk"
$distDir = Join-Path $root "dist"
$versionName = "0.12.1"
$keylessBuild = $env:BONVOY_KEYLESS_BUILD -eq "1"
$artifactSuffix = if ($keylessBuild) { "-keyless" } else { "" }

$javaExecutable = if ($javaHome) {
    Join-Path $javaHome "bin\java.exe"
} else {
    (Get-Command java -ErrorAction Stop).Source
}

foreach ($required in @(
    $javaExecutable,
    $gradle,
    (Join-Path $sdkRoot "platforms\android-35\android.jar"),
    (Join-Path $buildTools "apksigner.bat"),
    (Join-Path $buildTools "aapt2.exe")
)) {
    if (-not (Test-Path -LiteralPath $required)) {
        throw "缺少构建组件: $required"
    }
}

$oldJavaHome = $env:JAVA_HOME
$oldAndroidHome = $env:ANDROID_HOME
$oldAndroidSdkRoot = $env:ANDROID_SDK_ROOT
$oldPath = $env:PATH
$javaBin = Split-Path -Parent $javaExecutable

if ($javaHome) {
    $env:JAVA_HOME = $javaHome
}
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:PATH = (
    $javaBin + ";" +
    $buildTools + ";" +
    (Join-Path $sdkRoot "platform-tools") + ";" +
    $oldPath
)

Push-Location $root
try {
    $gradleTasks = if ($keylessBuild) {
        @("--no-daemon", ":app:clean", ":app:assembleRelease")
    } else {
        @("--no-daemon", ":app:assembleRelease")
    }
    & $gradle @gradleTasks
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle 构建失败"
    }

    $signed = Test-Path -LiteralPath $signedSource
    $sourceApk = if ($signed) { $signedSource } else { $unsignedSource }
    if (-not (Test-Path -LiteralPath $sourceApk)) {
        throw "未找到构建产物: $signedSource 或 $unsignedSource"
    }

    New-Item -ItemType Directory -Path $distDir -Force | Out-Null
    $suffix = if ($signed) { "" } else { "-unsigned" }
    $apkDestination = Join-Path $distDir (
        "BonvoyCompanion-{0}{1}{2}.apk" -f $versionName, $artifactSuffix, $suffix
    )
    Copy-Item -LiteralPath $sourceApk -Destination $apkDestination -Force

    if ($signed) {
        & (Join-Path $buildTools "apksigner.bat") verify --verbose $apkDestination
        if ($LASTEXITCODE -ne 0) {
            throw "APK 签名校验失败"
        }
    } else {
        Write-Warning "未找到 local-env/signing 中的本地签名配置，已输出未签名开发包。"
    }

    & (Join-Path $buildTools "aapt2.exe") dump badging $apkDestination
    if ($LASTEXITCODE -ne 0) {
        throw "APK 信息校验失败"
    }

    $apk = Get-Item -LiteralPath $apkDestination
    Write-Host ""
    Write-Host ("APK: {0}" -f $apk.FullName)
    Write-Host ("Size: {0:N0} bytes" -f $apk.Length)
} finally {
    Pop-Location
    $env:JAVA_HOME = $oldJavaHome
    $env:ANDROID_HOME = $oldAndroidHome
    $env:ANDROID_SDK_ROOT = $oldAndroidSdkRoot
    $env:PATH = $oldPath
}
