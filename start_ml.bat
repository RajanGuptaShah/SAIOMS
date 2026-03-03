@echo off
echo ============================================
echo  SAIOMS ML Service — Starting on port 8001
echo ============================================
cd /d "%~dp0ml-service"

REM Activate virtual environment if present
if exist ".venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call .venv\Scripts\activate.bat
) else if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
)

REM Install/update dependencies
echo Installing dependencies...
pip install -q -r requirements.txt

echo.
echo Starting ML service...
echo NOTE: CLIP model (~350 MB) will be downloaded on first run.
echo.
uvicorn main:app --reload --port 8001 --host 0.0.0.0
pause
