@echo off
setlocal enabledelayedexpansion

title SpeedForge Development Launcher
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

REM Store PIDs for cleanup
set "RUST_PID="
set "UI_PID="

echo %CYAN%========================================%RESET%
echo %MAGENTA%  SpeedForge Development Environment  %RESET%
echo %CYAN%========================================%RESET%
echo.

:MENU
echo %CYAN%Choose an option:%RESET%
echo %WHITE%1. Start both backend and UI%RESET%
echo %WHITE%2. Start Rust backend only%RESET%
echo %WHITE%3. Start UI only%RESET%
echo %WHITE%4. Build and package application%RESET%
echo %WHITE%5. Exit%RESET%
echo.
set /p CHOICE=%YELLOW%Enter your choice (1-5): %RESET%

if "%CHOICE%"=="1" goto START_BOTH
if "%CHOICE%"=="2" goto START_BACKEND
if "%CHOICE%"=="3" goto START_UI
if "%CHOICE%"=="4" goto BUILD_APP
if "%CHOICE%"=="5" goto EXIT
echo %RED%Invalid choice. Please try again.%RESET%
echo.
goto MENU

:START_BOTH
echo.
echo %YELLOW%Starting Rust Telemetry Backend...%RESET%
echo.

REM Start the Rust telemetry backend in a separate window
start "SpeedForge Telemetry" cmd /c "cd rust_app && run.bat && pause"

REM Wait a moment to ensure backend has time to start up
timeout /t 3 /nobreak > nul

echo %GREEN%Starting React UI Application...%RESET%
echo.

REM Start the React UI application
start "SpeedForge UI" cmd /c "npm run electron:dev"

echo %BLUE%Both applications started!%RESET%
echo.
echo %CYAN%========================================%RESET%
echo %WHITE%- Telemetry backend runs on port 8080%RESET%
echo %WHITE%- To stop all applications, close their windows%RESET%
echo %CYAN%========================================%RESET%
echo.
goto EXIT

:START_BACKEND
echo.
echo %YELLOW%Starting Rust Telemetry Backend...%RESET%
echo.

REM Start the Rust telemetry backend 
cd rust_app
call run.bat
cd ..
goto EXIT

:START_UI
echo.
echo %GREEN%Starting React UI Application...%RESET%
echo.

REM Check if the backend is already running by testing port 8080
netstat -an | find "8080" | find "LISTENING" > nul
if errorlevel 1 (
    echo %YELLOW%Warning: Telemetry backend doesn't seem to be running on port 8080.%RESET%
    echo %YELLOW%Widgets requiring telemetry data may not function correctly.%RESET%
    echo.
    set /p CONTINUE=%YELLOW%Continue anyway? (Y/N): %RESET%
    if /i "!CONTINUE!"=="N" goto MENU
)

REM Start the React UI application
npm run electron:dev
goto EXIT

:BUILD_APP
echo.
echo %BLUE%Building and packaging SpeedForge application...%RESET%
echo.

REM First build the Rust backend
echo %YELLOW%Building Rust backend...%RESET%
cd rust_app
cargo build --release
if errorlevel 1 (
    echo %RED%Rust backend build failed. Aborting packaging.%RESET%
    cd ..
    pause
    goto MENU
)
cd ..

REM Then build the UI application
echo %YELLOW%Building UI application...%RESET%
call npm run build

echo.
if errorlevel 1 (
    echo %RED%Build failed. See errors above.%RESET%
) else (
    echo %GREEN%Build completed successfully!%RESET%
    echo %GREEN%Distribution files are in the dist folder.%RESET%
)

pause
goto MENU

:EXIT
echo.
echo %MAGENTA%Thank you for using SpeedForge Development Environment%RESET%
echo.
timeout /t 2 /nobreak > nul
exit /b 0 