/**
 * Start Expo/Metro without launching an external browser (Edge, Chrome, etc.).
 * Strips --web/-w so `expo start --web` cannot auto-open the system browser.
 *
 * Usage: node scripts/expo-start.mjs [--clear] [--port 8081] ...
 */
import { spawn } from 'node:child_process';

const blockedFlags = new Set(['--web', '-w']);

const forwardedArgs = [];
for (const arg of process.argv.slice(2)) {
  if (blockedFlags.has(arg)) {
    console.warn(
      '[expo-start] Flag ignoré :',
      arg,
      '— pas d’ouverture auto du navigateur. Appuyez sur `w` dans Metro si besoin.'
    );
    continue;
  }
  forwardedArgs.push(arg);
}

const env = {
  ...process.env,
  BROWSER: 'none',
  EXPO_NO_REDIRECT_PAGE: '1',
};

const child = spawn('npx', ['expo', 'start', ...forwardedArgs], {
  stdio: 'inherit',
  shell: true,
  env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
