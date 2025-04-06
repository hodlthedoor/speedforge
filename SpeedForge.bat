@echo off
setlocal enabledelayedexpansion

title SpeedForge Telemetry Suite
cls

REM Set UTF-8 code page for better console output
chcp 65001 > nul

echo ========================================
echo         SpeedForge Telemetry         
echo ========================================
echo.

REM Check if iRacing is running
tasklist /fi "imagename eq iRacingSim64DX11.exe" | find "iRacingSim64DX11.exe" > nul
if errorlevel 1 (
    echo iRacing doesn't appear to be running.
    echo Some telemetry features may not work until you start iRacing.
    echo.
)

REM Check for updates to the Rust binary - placeholder for future functionality
REM echo Checking for updates...
REM timeout /t 1 /nobreak > nul
REM echo You're running the latest version.
REM echo.

echo Starting telemetry services...

REM Start the Rust telemetry backend silently in the background
start /b /min "" "speedforge_telemetry.exe"

REM Wait a moment to ensure backend has time to start up
timeout /t 2 /nobreak > nul

REM Verify the backend started properly
netstat -an | find "8080" | find "LISTENING" > nul
if errorlevel 1 (
    echo Warning: Telemetry service failed to start properly.
    echo Please check if another application is using port 8080.
    echo.
    set /p CONTINUE=Continue anyway? (Y/N): 
    if /i "!CONTINUE!"=="N" (
        echo Exiting SpeedForge...
        timeout /t 2 /nobreak > nul
        exit /b 1
    )
)

echo Telemetry service started successfully!
echo.

echo Launching SpeedForge Dashboard...
echo.

REM Launch the main Electron application
start "" "speedforge.exe"

echo ========================================
echo SpeedForge is now running in the background.
echo You can close this window or keep it open to
echo monitor the telemetry service.
echo ========================================
echo.

REM Keep the console open to monitor and keep the background process running
echo Press Ctrl+C to exit SpeedForge and close all components.

REM Wait indefinitely - the user can close with Ctrl+C
:WAIT_LOOP
timeout /t 10 /nobreak > nul
REM Check if the UI is still running
tasklist /fi "imagename eq speedforge.exe" | find "speedforge.exe" > nul
if errorlevel 1 (
    REM UI has been closed, so shut down the telemetry service too
    echo SpeedForge UI has been closed.
    echo Shutting down telemetry service...
    
    REM Find and kill the telemetry process
    for /f "tokens=2" %%a in ('tasklist /fi "imagename eq speedforge_telemetry.exe" ^| find "speedforge_telemetry.exe"') do (
        taskkill /pid %%a /f > nul 2>&1
    )
    
    echo SpeedForge has been shut down.
    timeout /t 2 /nobreak > nul
    exit /b 0
)
goto WAIT_LOOP 