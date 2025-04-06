@echo off
title SpeedForge Launcher
echo Starting SpeedForge iRacing Telemetry Suite...
echo.

REM Set UTF-8 code page for better console output
chcp 65001 > nul

echo ========================================
echo      SpeedForge Telemetry Suite     
echo ========================================
echo.

echo Starting Rust Telemetry Backend...
echo.

REM Start the Rust telemetry backend in a separate window
start "SpeedForge Telemetry" cmd /c "cd rust_app && run.bat"

REM Wait a moment to ensure backend has time to start up
timeout /t 3 /nobreak > nul

echo Starting React UI Application...
echo.

REM Start the React UI application
start "SpeedForge UI" cmd /c "npm run electron:dev"

echo Both applications started!
echo.
echo ========================================
echo - Telemetry backend runs on port 8080
echo - To stop all applications, close their windows
echo ========================================
echo.

echo Press any key to close this launcher window...
pause > nul 