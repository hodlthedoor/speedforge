@echo off
title SpeedForge Launcher
echo Starting SpeedForge iRacing Telemetry Suite...
echo.

REM Set UTF-8 code page for better console output
chcp 65001 > nul

REM Enable ANSI color support in Windows 10+
REM This uses PowerShell to enable virtual terminal processing
powershell -Command "&{$PHOST = Get-Host; $PWINDOW = $PHOST.UI.RawUI; $BSIZE = $PWINDOW.BufferSize; $CSI = [char]0x1B + '['; echo \"$CSI?25h\"; Add-Type -AssemblyName System.Console; $null = [System.Console]::SetBufferSize($BSIZE.Width, $BSIZE.Height)}"

REM Define colors for console output (Windows 10+)
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "MAGENTA=[95m"
set "CYAN=[96m"
set "WHITE=[97m"
set "RESET=[0m"

echo %CYAN%========================================%RESET%
echo %MAGENTA%     SpeedForge Telemetry Suite     %RESET%
echo %CYAN%========================================%RESET%
echo.

echo %YELLOW%Starting Rust Telemetry Backend...%RESET%
echo.

REM Start the Rust telemetry backend in a separate window
start "SpeedForge Telemetry" cmd /c "cd rust_app && run.bat"

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

echo %YELLOW%Press any key to close this launcher window...%RESET%
pause > nul 