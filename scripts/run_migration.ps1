# PowerShell script to run Firebase to Django migration
# This script helps you migrate your Firebase data to Django

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Firebase to Django Migration Helper" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if credentials path is set
$credPath = $env:FIREBASE_CREDENTIALS_PATH

if (-not $credPath) {
    Write-Host "ERROR: FIREBASE_CREDENTIALS_PATH environment variable is not set!" -ForegroundColor Red
    Write-Host ""
    Write-Host "To get your Firebase service account key:" -ForegroundColor Yellow
    Write-Host "1. Go to https://console.firebase.google.com/" -ForegroundColor White
    Write-Host "2. Select your Firebase project" -ForegroundColor White
    Write-Host "3. Click the gear icon (Settings) → Project Settings" -ForegroundColor White
    Write-Host "4. Go to the 'Service accounts' tab" -ForegroundColor White
    Write-Host "5. Click 'Generate new private key'" -ForegroundColor White
    Write-Host "6. Save the JSON file to your computer" -ForegroundColor White
    Write-Host ""
    Write-Host "Then set the environment variable:" -ForegroundColor Yellow
    Write-Host '  $env:FIREBASE_CREDENTIALS_PATH="C:\path\to\your\service-account-key.json"' -ForegroundColor White
    Write-Host ""
    Write-Host "Or provide the path now:" -ForegroundColor Yellow
    $credPath = Read-Host "Enter full path to your Firebase service account JSON file"
    
    if ($credPath -and (Test-Path $credPath)) {
        $env:FIREBASE_CREDENTIALS_PATH = $credPath
        Write-Host "Credentials path set to: $credPath" -ForegroundColor Green
    } else {
        Write-Host "Invalid path or file not found!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Using credentials from: $credPath" -ForegroundColor Green
}

# Verify the file exists
if (-not (Test-Path $env:FIREBASE_CREDENTIALS_PATH)) {
    Write-Host "ERROR: Credentials file not found at: $env:FIREBASE_CREDENTIALS_PATH" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting migration..." -ForegroundColor Cyan
Write-Host ""

# Change to backend directory and activate venv
$backendPath = Join-Path $PSScriptRoot ".." "backend"
$scriptPath = Join-Path $PSScriptRoot "migrate_firebase_to_django.py"

if (-not (Test-Path $backendPath)) {
    Write-Host "ERROR: Backend directory not found!" -ForegroundColor Red
    exit 1
}

# Activate virtual environment and run migration
Set-Location $backendPath

if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "Activating virtual environment..." -ForegroundColor Yellow
    & "venv\Scripts\Activate.ps1"
    
    Write-Host ""
    Write-Host "Running migration script..." -ForegroundColor Yellow
    Write-Host ""
    
    python $scriptPath
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Migration completed successfully!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Migration failed! Check the error messages above." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "ERROR: Virtual environment not found!" -ForegroundColor Red
    Write-Host "Please run the backend setup first:" -ForegroundColor Yellow
    Write-Host "  cd backend" -ForegroundColor White
    Write-Host "  python -m venv venv" -ForegroundColor White
    Write-Host "  venv\Scripts\Activate.ps1" -ForegroundColor White
    Write-Host "  pip install -r requirements.txt" -ForegroundColor White
    exit 1
}








