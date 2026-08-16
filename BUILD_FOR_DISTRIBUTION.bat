@echo off
REM =====================================================================
REM  StudioFlow - BUILD A COPY FOR SOMEONE ELSE
REM =====================================================================
REM  Use this ONLY if StudioFlow is going to anyone other than you.
REM  For your own machine use BUILD_DESKTOP_APP.bat as normal.
REM
REM  Black Crush is your font, licensed to you, not to StudioFlow. This
REM  moves it out of the way, builds the installer without it, and puts it
REM  back afterwards - even if the build fails. The Canada Day price cards
REM  in that copy fall back to Archivo Black, which is free to pass on.
REM =====================================================================
echo.
echo Building a DISTRIBUTION copy - your personal font is left out.
echo.
call npm run personal:hide
call npm run dist
set BUILD_RESULT=%ERRORLEVEL%
echo.
echo Putting your personal assets back...
call npm run personal:restore
echo.
if %BUILD_RESULT% NEQ 0 (echo The build FAILED - your font has still been restored.) else (echo Done. The installer in dist\\ does not contain your font.)
echo.
pause
