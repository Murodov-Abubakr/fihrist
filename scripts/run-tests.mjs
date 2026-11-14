// Launches Vitest with an upper-case Windows drive letter in cwd.
// Vitest 4 on Windows loads two copies of itself when the shell's cwd is "e:\..." instead of "E:\..."
// ("Vitest failed to find the current suite"). Elsewhere this is a plain passthrough.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform === 'win32') root = root[0].toUpperCase() + root.slice(1);

const bin = join(root, 'node_modules', 'vitest', 'vitest.mjs');
const r = spawnSync(process.execPath, [bin, 'run', ...process.argv.slice(2)], { cwd: root, stdio: 'inherit' });
process.exit(r.status ?? 1);
