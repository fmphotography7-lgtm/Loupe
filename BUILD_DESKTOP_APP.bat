@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  Building the StudioFlow desktop app
echo ============================================
echo.
echo This makes a proper Windows installer. Run it once; afterwards
echo StudioFlow starts from the desktop shortcut like any other program
echo and this folder is no longer needed to launch it.
echo.
echo It takes a few minutes and needs an internet connection the first
echo time, because electron-builder downloads the Windows packaging tools.
echo.
pause

if not exist "node_modules\electron-builder\package.json" (
  echo Installing build tools, this only happens once...
  call npm install
  if errorlevel 1 (
    echo.
    echo Setup failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

call npm run dist
if errorlevel 1 (
  echo.
  echo The build failed. The messages above say why.
  echo Send them over and they can be worked through.
  pause
  exit /b 1
)

echo.
echo ============================================
echo  Done.
echo ============================================
echo.
echo Look in the "dist" folder for:
echo.
echo   StudioFlow Setup 4.0.NNN.exe - the installer. Run it. It puts StudioFlow
echo                                  on your desktop and in the Start menu,
echo                                  with the StudioFlow icon.
echo.
echo   StudioFlow 4.0.NNN.exe       - a portable copy that runs from anywhere
echo                                  without installing, e.g. off a USB stick.
echo.
echo NNN is the build number, so 4.0.117 is build g117. It is set automatically
echo from the version shown in StudioFlow's sidebar - you never edit it. That is
echo also how Windows knows a new build is newer than the installed one.
echo.
echo Your database and backups are NOT touched by installing. They stay
echo in %%APPDATA%%\studioflow exactly where they are now, and the installed
echo app reads the same files this folder does.
echo.
echo TO UPDATE LATER: replace this folder with the new one, run this file
echo again, and run the new installer. It upgrades the installed copy in
echo place - no need to uninstall first, and nothing of yours is lost.
echo.
pause
endlocal
