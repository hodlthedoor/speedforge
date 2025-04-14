// Simple script to run both Rust and Electron development servers
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Determine the platform-specific command to use
const isWindows = os.platform() === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const cargoCmd = isWindows ? 'cargo.exe' : 'cargo';

console.log('Starting Rust backend and Electron app for development...');

// Function to spawn a process and pipe its output
function spawnProcess(cmd, args, cwd, name) {
  console.log(`Starting ${name}: ${cmd} ${args.join(' ')}`);
  
  const process = spawn(cmd, args, {
    cwd,
    stdio: 'pipe',
    shell: isWindows
  });
  
  process.stdout.on('data', (data) => {
    console.log(`[${name}] ${data.toString().trim()}`);
  });
  
  process.stderr.on('data', (data) => {
    console.error(`[${name} ERROR] ${data.toString().trim()}`);
  });
  
  process.on('close', (code) => {
    console.log(`${name} process exited with code ${code}`);
  });
  
  return process;
}

// Start Rust backend
const rustProcess = spawnProcess(
  cargoCmd,
  ['run', '--verbose'],
  path.join(process.cwd(), 'rust_app'),
  'Rust'
);

// Start Electron app
const electronProcess = spawnProcess(
  npmCmd,
  ['run', 'electron:dev'],
  process.cwd(),
  'Electron'
);

// Handle process exit
process.on('SIGINT', () => {
  console.log('Shutting down development processes...');
  
  if (rustProcess) {
    rustProcess.kill();
  }
  
  if (electronProcess) {
    electronProcess.kill();
  }
  
  process.exit(0);
});

// Keep the script running
console.log('Development environment started. Press Ctrl+C to exit.'); 