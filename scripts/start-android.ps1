$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$nodeRoot = Join-Path $repoRoot '.toolchain/node'
$npm = Join-Path $nodeRoot 'npm.cmd'
if (-not (Test-Path $npm)) {
    throw 'Project Node.js is missing. Run .\scripts\setup.ps1 first.'
}
$env:Path = "$nodeRoot;$env:Path"
Push-Location $repoRoot
try {
    & $npm run start:dev-client -- --lan
    if ($LASTEXITCODE -ne 0) { throw 'Expo dev server exited with an error.' }
} finally {
    Pop-Location
}
