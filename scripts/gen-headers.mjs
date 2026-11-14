// Writes public/_headers (Cloudflare Pages format) from security-headers.ts.
// Runs automatically before `npm run build`. Requires Node >= 22.18 (native TS type stripping).
import { writeFileSync } from 'node:fs';
import { SECURITY_HEADERS } from '../security-headers.ts';

const lines = ['/*', ...Object.entries(SECURITY_HEADERS).map(([k, v]) => `  ${k}: ${v}`), ''];
writeFileSync(new URL('../public/_headers', import.meta.url), lines.join('\n'));
console.log('public/_headers written');
