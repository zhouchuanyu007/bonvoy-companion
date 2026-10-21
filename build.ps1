param(
    [switch]$SkipClean
)

$ErrorActionPreference = "Stop"
$builder = Join-Path $PSScriptRoot "build-gradle.ps1"

if (-not (Test-Path -LiteralPath $builder)) {
    throw "Missing build script: $builder"
}

& $builder
exit $LASTEXITCODE
