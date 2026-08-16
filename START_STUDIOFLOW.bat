@echo off
setlocal
cd /d "%~dp0"
echo Starting StudioFlow 3.5.1...

if not exist "node_modules\electron\dist\electron.exe" (
  echo Installing required packages, this only happens once...
  call npm install
  if errorlevel 1 (
    echo.
    echo Setup failed. Please check your internet connection and try again.
    pause
    exit /b 1
  )
)

call npm start
if errorlevel 1 pause
endlocal
