@echo off
echo Starting Cosmo Project Manager on port 5555...
set PORT=5555
call "C:\Program Files\nodejs\npm.cmd" run dev -- --port 5555
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Application failed to start.
)
pause