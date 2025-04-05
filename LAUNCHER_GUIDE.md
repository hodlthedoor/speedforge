# SpeedForge Launcher Guide

This guide explains how to use the different launcher scripts for SpeedForge.

## For Development

There are two scripts for development purposes:

### 1. Simple Starter (`start.bat`)

This is a simple script that launches both the Rust telemetry backend and the Electron UI application in separate windows. Use this when you want to quickly start the entire application for testing.

- **How to use**: Double-click `start.bat` in Windows Explorer or run it from a command prompt
- **What it does**: 
  - Starts the Rust backend telemetry service in a separate window
  - Launches the Electron UI application in development mode
  - Both windows will remain open and show console output

### 2. Development Environment (`dev.bat`)

This is a more advanced script with multiple options for development tasks. Use this for more control during development.

- **How to use**: Double-click `dev.bat` in Windows Explorer or run it from a command prompt
- **Options**:
  1. **Start both backend and UI** - Launches both applications in separate windows
  2. **Start Rust backend only** - Only starts the telemetry service
  3. **Start UI only** - Only starts the Electron UI (warns if backend is not detected)
  4. **Build and package application** - Builds both the Rust backend and Electron UI for distribution
  5. **Exit** - Closes the launcher

- **Features**:
  - Color-coded output for better readability
  - Error checking and validation
  - Port availability checking
  - Build process for both components

## For Production

### Production Launcher (`SpeedForge.bat`)

This script is designed for the packaged application that users will run. It's built to be user-friendly and handle errors gracefully.

- **How to use**: Double-click `SpeedForge.bat` (typically installed with the application)
- **What it does**:
  - Checks if iRacing is running and warns if not
  - Starts the telemetry service silently in the background
  - Launches the main Electron application
  - Monitors the application and cleanly shuts down everything when the UI is closed
  - Provides feedback on the status of services

- **Features**:
  - Checks for proper startup of services
  - Handles errors gracefully with user prompts
  - Automatically cleans up processes when the UI is closed
  - Visually appealing with color-coded messages

## Troubleshooting

If you encounter issues with the launchers:

1. **Telemetry service won't start**:
   - Check if port 8080 is already in use by another application
   - Ensure you have the necessary permissions to run the services

2. **UI won't launch**:
   - Check if Node.js and npm are properly installed
   - Ensure all dependencies are installed with `npm install`

3. **Both components start but widgets don't receive data**:
   - Verify iRacing is running
   - Check if the telemetry service shows any errors in its console
   - Ensure there are no firewall rules blocking localhost communication

## Notes

- The telemetry service must be running for the widgets to receive data
- These scripts are designed for Windows systems
- For development, you'll need both Rust and Node.js installed
- For production, the executables should be packaged with the application 