@echo off
echo Building SpeedForge iRacing Telemetry Monitor...
cargo build

if %ERRORLEVEL% == 0 (
  echo Build successful! Running the app...
  echo ----------------------------------------
  cargo run
) else (
  echo Build failed. Please check the errors above.
  pause
) 