import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';

const preferredPort = Number(process.env.SONIC_ELECTRON_DEV_PORT || '3000');

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found from ${startPort} to ${startPort + 49}`);
}

function spawnProcess(command, args, options = {}) {
  return spawn(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
}

function waitForHttp(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });
      request.on('error', () => {
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${url}`));
          return;
        }
        setTimeout(tick, 250);
      });
      request.setTimeout(1000, () => {
        request.destroy();
      });
    };
    tick();
  });
}

const devPort = await findAvailablePort(preferredPort);
const devUrl = `http://127.0.0.1:${devPort}`;
const vite = spawnProcess('npx', ['vite', '--host', '127.0.0.1', '--port', String(devPort), '--strictPort']);
let electron = null;
let shuttingDown = false;

const shutdown = (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (electron && !electron.killed) electron.kill();
  if (!vite.killed) vite.kill();
  process.exit(exitCode);
};

process.on('SIGINT', () => {
  shutdown(130);
});
process.on('SIGTERM', () => {
  shutdown(143);
});

vite.on('exit', (code) => {
  if (shuttingDown) return;
  console.error(`Vite dev server exited with code ${code ?? 0}. Closing Electron.`);
  shutdown(code ?? 1);
});

try {
  await waitForHttp(devUrl);
  electron = spawnProcess('npx', ['electron', '.'], {
    env: {
      ...process.env,
      SONIC_ELECTRON_DEV_URL: devUrl,
    },
  });
  electron.on('exit', (code) => {
    shutdown(code ?? 0);
  });
} catch (error) {
  console.error(error);
  shutdown(1);
}
