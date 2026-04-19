# SAIOMS — Local Development Launcher (No Docker)
# Starts: MongoDB check - ML Service - Backend - Frontend

$ErrorActionPreference = "Continue"
$projectRoot = "D:\SAIOMS"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   SAIOMS - Local Full-Stack Launcher" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# -- 1. Check MongoDB ----------------------------------------------------------
Write-Host "[1/4] Checking MongoDB..." -ForegroundColor Yellow
$mongoService = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if ($mongoService -and $mongoService.Status -eq "Running") {
    Write-Host "  OK MongoDB is running on port 27017" -ForegroundColor Green
} else {
    Write-Host "  > Starting MongoDB service..." -ForegroundColor Yellow
    Start-Service -Name "MongoDB" -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    Write-Host "  OK MongoDB started" -ForegroundColor Green
}

# -- 2. ML Service -------------------------------------------------------------
Write-Host ""
Write-Host "[2/4] Starting ML Service (FastAPI on port 8001)..." -ForegroundColor Yellow

$mlScript = @"
cd D:\SAIOMS\ml-service
D:\SAIOMS\.venv\Scripts\python.exe -m pip install -q -r requirements.txt
D:\SAIOMS\.venv\Scripts\uvicorn main:app --port 8001 --host 0.0.0.0
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$ErrorActionPreference = 'Continue'; $mlScript" -WindowStyle Normal

Write-Host "  OK ML Service window launched (port 8001)" -ForegroundColor Green
Write-Host "  ! First run: CLIP model (~350 MB) will be downloaded" -ForegroundColor DarkYellow

# -- 3. Backend ----------------------------------------------------------------
Write-Host ""
Write-Host "[3/4] Starting Backend (Node.js/Express on port 5000)..." -ForegroundColor Yellow
Write-Host "  > Waiting 10s for ML service to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 10

$backendScript = @"
cd D:\SAIOMS\backend
node src/app.js
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$ErrorActionPreference = 'Continue'; $backendScript" -WindowStyle Normal
Write-Host "  OK Backend window launched (port 5000)" -ForegroundColor Green

# -- 4. Frontend ---------------------------------------------------------------
Write-Host ""
Write-Host "[4/4] Starting Frontend (React/Vite on port 5173)..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

$frontendScript = @"
cd D:\SAIOMS\frontend
npm run dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$ErrorActionPreference = 'Continue'; $frontendScript" -WindowStyle Normal
Write-Host "  OK Frontend window launched" -ForegroundColor Green

# -- Summary -------------------------------------------------------------------
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  All services started! Access points:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Frontend  ->  http://localhost:5173" -ForegroundColor White
Write-Host "  Backend   ->  http://localhost:5000" -ForegroundColor White
Write-Host "  ML API    ->  http://localhost:8001/docs" -ForegroundColor White
Write-Host "  MongoDB   ->  localhost:27017" -ForegroundColor White
Write-Host ""
Write-Host "  Check each terminal window for detailed logs." -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Open the app in browser after a short delay
Write-Host "Opening app in browser in 15 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 15
Start-Process "http://localhost:5173"
