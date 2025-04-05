@echo off
setlocal enabledelayedexpansion

title SpeedForge Telemetry Suite
cls

REM Set UTF-8 code page for better console output
chcp 65001 > nul

REM Define colors for console output (Windows 10+)
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "BLUE=[94m"
set "MAGENTA=[95m"
set "CYAN=[96m"
set "WHITE=[97m"
set "RESET=[0m"

echo %CYAN%========================================%RESET%
echo %MAGENTA%        SpeedForge Telemetry         %RESET%
echo %CYAN%========================================%RESET%
echo.

REM Check if iRacing is running
tasklist /fi "imagename eq iRacingSim64DX11.exe" | find "iRacingSim64DX11.exe" > nul
if errorlevel 1 (
    echo %YELLOW%iRacing doesn't appear to be running.%RESET%
    echo %YELLOW%Some telemetry features may not work until you start iRacing.%RESET%
    echo.
)

REM Check for updates to the Rust binary - placeholder for future functionality
REM echo %BLUE%Checking for updates...%RESET%
REM timeout /t 1 /nobreak > nul
REM echo %GREEN%You're running the latest version.%RESET%
REM echo.

echo %YELLOW%Starting telemetry services...%RESET%

REM Start the Rust telemetry backend silently in the background
start /b /min "" "speedforge_telemetry.exe"

REM Wait a moment to ensure backend has time to start up
timeout /t 2 /nobreak > nul

REM Verify the backend started properly
netstat -an | find "8080" | find "LISTENING" > nul
if errorlevel 1 (
    echo %RED%Warning: Telemetry service failed to start properly.%RESET%
    echo %RED%Please check if another application is using port 8080.%RESET%
    echo.
    set /p CONTINUE=%YELLOW%Continue anyway? (Y/N): %RESET%
    if /i "!CONTINUE!"=="N" (
        echo %MAGENTA%Exiting SpeedForge...%RESET%
        timeout /t 2 /nobreak > nul
        exit /b 1
    )
)

echo %GREEN%Telemetry service started successfully!%RESET%
echo.

echo %BLUE%Launching SpeedForge Dashboard...%RESET%
echo.

REM Launch the main Electron application
start "" "speedforge.exe"

echo %CYAN%========================================%RESET%
echo %WHITE%SpeedForge is now running in the background.%RESET%
echo %WHITE%You can close this window or keep it open to%RESET%
echo %WHITE%monitor the telemetry service.%RESET%
echo %CYAN%========================================%RESET%
echo.

REM Keep the console open to monitor and keep the background process running
echo %YELLOW%Press Ctrl+C to exit SpeedForge and close all components.%RESET%

REM Wait indefinitely - the user can close with Ctrl+C
:WAIT_LOOP
timeout /t 10 /nobreak > nul
REM Check if the UI is still running
tasklist /fi "imagename eq speedforge.exe" | find "speedforge.exe" > nul
if errorlevel 1 (
    REM UI has been closed, so shut down the telemetry service too
    echo %YELLOW%SpeedForge UI has been closed.%RESET%
    echo %YELLOW%Shutting down telemetry service...%RESET%
    
    REM Find and kill the telemetry process
    for /f "tokens=2" %%a in ('tasklist /fi "imagename eq speedforge_telemetry.exe" ^| find "speedforge_telemetry.exe"') do (
        taskkill /pid %%a /f > nul 2>&1
    )
    
    echo %MAGENTA%SpeedForge has been shut down.%RESET%
    timeout /t 2 /nobreak > nul
    exit /b 0
)
goto WAIT_LOOP 