/**
 * Wipe Windows-path autolinking caches before Gradle on EAS Linux.
 * Without this, RN community modules resolve as "No variants exist".
 * @see https://github.com/expo/expo/issues/42370
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  path.join(root, 'android', 'build', 'generated', 'autolinking'),
  path.join(root, 'android', 'app', 'build', 'generated', 'autolinking'),
];

for (const dir of targets) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`[eas-clear-autolinking-cache] removed ${dir}`);
  }
}
