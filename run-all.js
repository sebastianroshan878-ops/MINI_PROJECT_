const { spawn } = require('child_process');
const path = require('path');

const rootDir = __dirname;
const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

console.log('\x1b[36m%s\x1b[0m', '==================================================');
console.log('\x1b[36m%s\x1b[0m', '   Starting RestaurantPro (Backend + Frontend)... ');
console.log('\x1b[36m%s\x1b[0m', '==================================================\n');

function runService(name, colorCode, subDir, script) {
  const child = spawn(`${npmCmd} run ${script}`, {
    cwd: path.join(rootDir, subDir),
    shell: true,
    stdio: 'pipe'
  });

  const prefix = `\x1b[${colorCode}m[${name}]\x1b[0m `;

  const formatOutput = (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line.trim().length > 0) {
        console.log(`${prefix}${line}`);
      }
    });
  };

  child.stdout.on('data', formatOutput);
  child.stderr.on('data', formatOutput);

  child.on('close', (code) => {
    console.log(`${prefix}Process exited with code ${code}`);
  });

  return child;
}

// Start backend (Cyan: 36) and frontend (Green: 32)
const backend = runService('Backend', '36', 'backend', 'dev');
const frontend = runService('Frontend', '32', 'frontend', 'dev');

function shutdown() {
  console.log('\n\x1b[33mShutting down RestaurantPro services...\x1b[0m');
  try {
    if (backend && !backend.killed) {
      if (isWindows) {
        spawn('taskkill', ['/pid', backend.pid, '/f', '/t']);
      } else {
        backend.kill('SIGINT');
      }
    }
  } catch (e) {}

  try {
    if (frontend && !frontend.killed) {
      if (isWindows) {
        spawn('taskkill', ['/pid', frontend.pid, '/f', '/t']);
      } else {
        frontend.kill('SIGINT');
      }
    }
  } catch (e) {}

  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
