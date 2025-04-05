#!/bin/bash

echo "Building SpeedForge iRacing Telemetry Monitor..."
cargo build

if [ $? -eq 0 ]; then
  echo "Build successful! Running the app..."
  echo "----------------------------------------"
  cargo run
else
  echo "Build failed. Please check the errors above."
fi 