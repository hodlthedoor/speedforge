@echo off
setlocal enabledelayedexpansion

title SpeedForge Development Launcher
cls

REM Set UTF-8 code page for better console output
chcp 65001 > nul

REM Store PIDs for cleanup
set "RUST_PID="
set "UI_PID="

echo ========================================
echo   SpeedForge Development Environment  
echo ========================================
echo.

:MENU
echo Choose an option:
echo 1. Start both backend and UI
echo 2. Start Rust backend only
echo 3. Start UI only
echo 4. Build and package application
echo 5. Exit
echo.
set /p CHOICE=Enter your choice (1-5): 

if "%CHOICE%"=="1" goto START_BOTH
if "%CHOICE%"=="2" goto START_BACKEND
if "%CHOICE%"=="3" goto START_UI
if "%CHOICE%"=="4" goto BUILD_APP
if "%CHOICE%"=="5" goto EXIT
echo Invalid choice. Please try again.
echo.
goto MENU

:START_BOTH
echo.
echo Starting Rust Telemetry Backend...
echo.

REM Start the Rust telemetry backend in a separate window
start "SpeedForge Telemetry" cmd /c "cd rust_app && run.bat && pause"

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
goto EXIT

:START_BACKEND
echo.
echo Starting Rust Telemetry Backend...
echo.

REM Start the Rust telemetry backend 
cd rust_app
call run.bat
cd ..
goto EXIT

:START_UI
echo.
echo Starting React UI Application...
echo.

REM Check if the backend is already running by testing port 8080
netstat -an | find "8080" | find "LISTENING" > nul
if errorlevel 1 (
    echo Warning: Telemetry backend doesn't seem to be running on port 8080.
    echo Widgets requiring telemetry data may not function correctly.
    echo.
    set /p CONTINUE=Continue anyway? (Y/N): 
    if /i "!CONTINUE!"=="N" goto MENU
)

REM Start the React UI application
npm run electron:dev
goto EXIT

:BUILD_APP
echo.
echo Building and packaging SpeedForge application...
echo.

REM First build the Rust backend
echo Building Rust backend...
cd rust_app
cargo build --release
if errorlevel 1 (
    echo Rust backend build failed. Aborting packaging.
    cd ..
    pause
    goto MENU
)
cd ..

REM Then build the UI application
echo Building UI application...
call npm run build

echo.
if errorlevel 1 (
    echo Build failed. See errors above.
) else (
    echo Build completed successfully!
    echo Distribution files are in the dist folder.
)

pause
goto MENU

:EXIT
echo.
echo Thank you for using SpeedForge Development Environment
echo.
timeout /t 2 /nobreak > nul
exit /b 0 