$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$toolchainRoot = Join-Path $repoRoot '.toolchain'
$nodeRoot = Join-Path $toolchainRoot 'node'
$nodeVersion = 'v22.23.3'
$archiveName = "node-$nodeVersion-win-x64.zip"
$archivePath = Join-Path $toolchainRoot $archiveName
$releaseUrl = "https://nodejs.org/dist/$nodeVersion"

New-Item -ItemType Directory -Force -Path $toolchainRoot | Out-Null

if (-not (Test-Path (Join-Path $nodeRoot 'node.exe'))) {
    Write-Host "Downloading Node.js $nodeVersion (Windows x64)..."
    $checksums = (Invoke-WebRequest -Uri "$releaseUrl/SHASUMS256.txt" -UseBasicParsing).Content
    $checksumLine = $checksums -split "`r?`n" | Where-Object {
        $_ -match "\s+$([regex]::Escape($archiveName))$"
    } | Select-Object -First 1
    if (-not $checksumLine) { throw "No published SHA-256 entry found for $archiveName" }
    $expectedHash = ($checksumLine -split '\s+')[0].ToLowerInvariant()

    Invoke-WebRequest -Uri "$releaseUrl/$archiveName" -OutFile $archivePath -UseBasicParsing
    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToLowerInvariant()
    if ($actualHash -ne $expectedHash) { throw "SHA-256 verification failed for $archiveName" }

    & tar -xf $archivePath -C $toolchainRoot
    if ($LASTEXITCODE -ne 0) { throw 'Could not extract the Node.js archive.' }
    Move-Item -LiteralPath (Join-Path $toolchainRoot "node-$nodeVersion-win-x64") -Destination $nodeRoot -Force
    Remove-Item -LiteralPath $archivePath -Force
}

$env:Path = "$nodeRoot;$env:Path"
Write-Host "Using Node $(& (Join-Path $nodeRoot 'node.exe') --version) and npm $(& (Join-Path $nodeRoot 'npm.cmd') --version)"
Push-Location $repoRoot
try {
    & (Join-Path $nodeRoot 'npm.cmd') install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
} finally {
    Pop-Location
}

Write-Host 'Project setup complete. Start Expo with: .\scripts\start-android.ps1'
