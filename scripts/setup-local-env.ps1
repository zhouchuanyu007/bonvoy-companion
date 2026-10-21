param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$localEnv = Join-Path $root "local-env"
$example = Join-Path $root "secrets.properties.example"
$destination = Join-Path $localEnv "secrets.properties"

if (-not (Test-Path -LiteralPath $example)) {
    throw "Missing secrets example: $example"
}

New-Item -ItemType Directory -Path $localEnv -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $localEnv "signing") -Force | Out-Null

if ((Test-Path -LiteralPath $destination) -and -not $Force) {
    Write-Host "Keeping existing local-env/secrets.properties"
} else {
    Copy-Item -LiteralPath $example -Destination $destination -Force
    Write-Host "Created local-env/secrets.properties from the example"
}

Write-Host "Edit local-env/secrets.properties to add your own API credentials."
