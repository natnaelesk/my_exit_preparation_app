# PowerShell script to set up Supabase connection
# Usage: .\scripts\setup_supabase.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Supabase Database Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get connection string from user
$connectionString = Read-Host "Enter your Supabase PostgreSQL connection string (from Settings > Database > Connection string > URI)"

if ([string]::IsNullOrWhiteSpace($connectionString)) {
    Write-Host "ERROR: Connection string is required!" -ForegroundColor Red
    exit 1
}

# Set environment variable
$env:DATABASE_URL = $connectionString
Write-Host ""
Write-Host "[OK] DATABASE_URL set" -ForegroundColor Green
Write-Host ""

# Test connection
Write-Host "Testing connection..." -ForegroundColor Yellow
python backend\venv\Scripts\python.exe scripts\test_supabase_connection.py

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Connection successful! Now run migrations:" -ForegroundColor Green
    Write-Host "  cd backend" -ForegroundColor White
    Write-Host "  .\venv\Scripts\python.exe manage.py migrate" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "Connection failed. Please check your connection string." -ForegroundColor Red
    Write-Host "Get it from: Supabase Dashboard > Settings > Database > Connection string > URI" -ForegroundColor Yellow
}







