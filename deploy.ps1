# Arbflow Extension Deploy Script for Windows 11

# 1. Git pull from develop branch
Write-Host "Pulling from develop branch..." -ForegroundColor Cyan
git pull origin develop

if ($LASTEXITCODE -ne 0) {
    Write-Host "Git pull failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Git pull completed!" -ForegroundColor Green

# 2. Find latest zip in package folder
$packagePath = Join-Path $PSScriptRoot "package"

if (-not (Test-Path $packagePath)) {
    Write-Host "Package folder not found!" -ForegroundColor Red
    exit 1
}

$latestZip = Get-ChildItem -Path $packagePath -Filter "*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $latestZip) {
    Write-Host "No zip file found in package folder!" -ForegroundColor Red
    exit 1
}

Write-Host "Found latest version: $($latestZip.Name)" -ForegroundColor Cyan

# 3. Get desktop path and remove existing arb folder if exists
$desktopPath = [Environment]::GetFolderPath("Desktop")
$arbPath = Join-Path $desktopPath "arb"

if (Test-Path $arbPath) {
    Write-Host "Removing existing arb folder..." -ForegroundColor Yellow
    Remove-Item -Path $arbPath -Recurse -Force
    Write-Host "Existing arb folder removed!" -ForegroundColor Green
}

# 4. Extract latest zip to desktop as arb
Write-Host "Extracting $($latestZip.Name) to desktop as arb..." -ForegroundColor Cyan
Expand-Archive -Path $latestZip.FullName -DestinationPath $arbPath -Force

Write-Host "Deploy completed! arb folder is now on your desktop." -ForegroundColor Green

