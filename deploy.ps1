# Arbflow Extension Deploy Script for Windows 11

# 1. Git pull from develop branch
Write-Host "Pulling from develop branch..." -ForegroundColor Cyan
git pull origin develop

if ($LASTEXITCODE -ne 0) {
    Write-Host "Git pull failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Git pull completed!" -ForegroundColor Green

# 2. Get desktop path and remove existing arb folder if exists
$desktopPath = [Environment]::GetFolderPath("Desktop")
$arbPath = Join-Path $desktopPath "arb"

if (Test-Path $arbPath) {
    Write-Host "Removing existing arb folder..." -ForegroundColor Yellow
    Remove-Item -Path $arbPath -Recurse -Force
    Write-Host "Existing arb folder removed!" -ForegroundColor Green
}

# 3. Copy build folder to desktop and rename to arb
$buildPath = Join-Path $PSScriptRoot "build"

if (-not (Test-Path $buildPath)) {
    Write-Host "Build folder not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Copying build folder to desktop as arb..." -ForegroundColor Cyan
Copy-Item -Path $buildPath -Destination $arbPath -Recurse

Write-Host "Deploy completed! arb folder is now on your desktop." -ForegroundColor Green

