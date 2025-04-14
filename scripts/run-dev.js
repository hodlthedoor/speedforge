// Simple script to run both Rust and Electron development servers
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// Get the current directory path (equivalent to __dirname in CommonJS)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

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
  path.join(projectRoot, 'rust_app'),
  'Rust'
);

// Start Electron app
const electronProcess = spawnProcess(
  npmCmd,
  ['run', 'electron:dev'],
  projectRoot,
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