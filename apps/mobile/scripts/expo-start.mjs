/**
 * Start Expo/Metro targeting **Expo Go** by default (day-to-day).
 *
 * Why: `expo-dev-client` is installed for EAS / `expo run:*` prebuilds. Without
 * `--go`, `expo start` prefers the development-build deep link
 * (`exp+budget-tracker://` / `budgettracker://`) — which opens a deleted or
 * stale native client instead of Expo Go + the current JS bundle.
 *
 * - `npm start` → Expo Go (`--go`)
 * - `npm run start:dev-client` → custom client (`--dev-client`)
 * Strips `--web` / `-w` so the system browser does not auto-open.
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

const hasGo = forwardedArgs.includes('--go') || forwardedArgs.includes('-g');
const hasDevClient =
  forwardedArgs.includes('--dev-client') || forwardedArgs.includes('-d');

// Default to Expo Go unless an explicit development-build flag is present.
if (!hasGo && !hasDevClient) {
  forwardedArgs.unshift('--go');
  console.log(
    '[expo-start] Cible Expo Go (--go). Pour un prebuild / dev client : npm run start:dev-client'
  );
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
