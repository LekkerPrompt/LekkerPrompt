#!/usr/bin/env node
// Starts Next.js dev (or prod) then launches Electron.
const { spawn } = require('child_process');
const path = require('path');

const isProd = process.argv.includes('--prod');

/** Start Next.js (dev or prod) without relying on spawning npm directly. */
/** @returns {Promise<void>} */
function startNext() {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ELECTRON: '1' };
    if (!isProd) {
      // Dev: run `next dev --turbo` via Node directly.
      let nextBin;
      try { nextBin = require.resolve('next/dist/bin/next'); }
  catch (e) { const err = /** @type {any} */ (e); return reject(new Error('Cannot resolve next binary: ' + err.message)); }
      const child = spawn(process.execPath, [nextBin, 'dev', '--turbo'], { stdio: 'inherit', env });
      child.on('error', reject);
      const http = require('http');
      const start = Date.now();
      const timeoutMs = 25000;
      function check() {
  const req = http.get('http://localhost:3000', res => { res.destroy(); resolve(undefined); });
        req.on('error', () => {
          if (Date.now() - start > timeoutMs) return reject(new Error('Dev server did not start within timeout'));
          setTimeout(check, 600);
        });
      }
      child.once('spawn', () => setTimeout(check, 1200));
    } else {
      // Prod: assume `next build` already run; start Next server programmatically.
      (async () => {
        try {
          const nextModule = require('next/dist/server/next');
          const nextApp = nextModule.default({ dev: false, dir: path.join(__dirname, '..') });
          await nextApp.prepare();
          const http = require('http');
          const handle = nextApp.getRequestHandler();
          const server = http.createServer((req, res) => handle(req, res));
          await new Promise((r, rej) => server.listen(3000).once('error', rej).once('listening', () => r(undefined)));
          resolve(undefined);
        } catch (e) {
          reject(e);
        }
      })();
    }
  });
}

(async () => {
  await startNext();
  const electronModule = require('electron');
  const electronCmd = typeof electronModule === 'string' ? electronModule : 'electron';
  const proc = spawn(electronCmd, [path.join(__dirname, 'main.cjs')], { stdio: 'inherit', env: { ...process.env, ELECTRON: '1' } });
  proc.on('exit', (code) => process.exit(code ?? 0));
})();
