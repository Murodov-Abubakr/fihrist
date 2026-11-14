/**
 * Security regression tests (OWASP A02, A03, A05, A06, A08).
 * Static scans walk the repo source; behavioural tests exercise the input sanitisers.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { clampLat, isValidLatLon, wrapLon } from './lib/geo';
import { SECURITY_HEADERS } from '../security-headers';

const ROOT = join(__dirname, '..');
const SKIP = new Set(['node_modules', 'dist', '.git', 'screenshots', '.wrangler']);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const files = walk(ROOT);
const code = files.filter((f) => /\.(ts|tsx|js|mjs|html)$/.test(f) && !f.endsWith('security.test.ts'));

describe('A03 injection sinks', () => {
  it.each([
    ['eval(', /\beval\s*\(/],
    ['new Function', /new\s+Function\s*\(/],
    ['dangerouslySetInnerHTML', /dangerouslySetInnerHTML/],
    ['innerHTML assignment', /\.innerHTML\s*=/],
    ['document.write', /document\.write\s*\(/],
  ])('no %s in source', (_label, re) => {
    const hits = code.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f));
    expect(hits).toEqual([]);
  });
});

describe('A02 secrets & transport', () => {
  it('no secret-like strings in tracked source', () => {
    const patterns = [
      /AKIA[0-9A-Z]{16}/, // AWS access key
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
      /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, // GitHub token
      /\bsk-[A-Za-z0-9_-]{20,}\b/, // generic API secret key
      /(api[_-]?key|secret|token|password)\s*[:=]\s*['"][^'"]{12,}['"]/i,
    ];
    const text = files.filter((f) => /\.(ts|tsx|js|mjs|json|html|md|py|toml|txt)$/.test(f) && !f.endsWith('package-lock.json') && !f.endsWith('security.test.ts'));
    const hits = text.filter((f) => patterns.some((re) => re.test(readFileSync(f, 'utf8')))).map((f) => relative(ROOT, f));
    expect(hits).toEqual([]);
  });

  it('no .env / key files exist outside ignored folders', () => {
    const bad = files.filter((f) => /(^|[\\/])\.env(\.|$)|\.(pem|key|p12)$|\.dev\.vars$/.test(f) && !f.endsWith('.env.example'));
    expect(bad.map((f) => relative(ROOT, f))).toEqual([]);
  });

  it('.gitignore blocks secrets and caches', () => {
    const gi = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    for (const p of ['.env', '.dev.vars', '*.pem', '*.key', '__pycache__/', 'node_modules']) expect(gi).toContain(p);
  });

  it('every external URL in app source is https', () => {
    // test files are excluded: they deliberately contain hostile URLs (SSRF payloads) as fixtures
    const src = code.filter((f) => (f.includes(`${join(ROOT, 'src')}`) && !f.endsWith('.test.ts')) || f.endsWith('index.html'));
    const insecure = src.flatMap((f) => (readFileSync(f, 'utf8').match(/http:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org)[^\s'"`)]+/g) ?? []).map((u) => `${relative(ROOT, f)}: ${u}`));
    expect(insecure).toEqual([]);
  });
});

describe('A05 security headers', () => {
  it('CSP is strict (no unsafe-inline/eval for scripts, no wildcards, framing denied)', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy'];
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/unsafe-eval|unsafe-inline|\*/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
  it('baseline headers present', () => {
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
    expect(SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });
  it('public/_headers (Cloudflare) matches security-headers.ts', () => {
    const file = readFileSync(join(ROOT, 'public', '_headers'), 'utf8');
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(file).toContain(`${k}: ${v}`);
  });
  it('index.html loads no third-party scripts or stylesheets', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    expect(html).not.toMatch(/<(script|link)[^>]+(src|href)="https?:\/\//);
  });
});

describe('A06 supply chain', () => {
  it('all dependencies are pinned to exact versions', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const all = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
    const loose = Object.entries(all).filter(([, v]) => !/^\d+\.\d+\.\d+$/.test(v));
    expect(loose).toEqual([]);
  });
});

describe('A03/A08 coordinate sanitisers', () => {
  it('clampLat bounds, rounds and neutralises non-finite input', () => {
    expect(clampLat(91)).toBe(90);
    expect(clampLat(-1e9)).toBe(-90);
    expect(clampLat(NaN)).toBe(0);
    expect(clampLat(Infinity)).toBe(0);
    expect(clampLat(38.559812345)).toBe(38.5598);
  });
  it('wrapLon wraps across the antimeridian', () => {
    expect(wrapLon(181)).toBe(-179);
    expect(wrapLon(-181)).toBe(179);
    expect(wrapLon(540)).toBe(-180);
    expect(wrapLon(-99.3)).toBe(-99.3);
    expect(wrapLon(NaN)).toBe(0);
  });
  it('isValidLatLon rejects strings, injection payloads and out-of-range values', () => {
    expect(isValidLatLon(38.5, 68.7)).toBe(true);
    expect(isValidLatLon('38.5', 68.7)).toBe(false);
    expect(isValidLatLon('<script>alert(1)</script>', 0)).toBe(false);
    expect(isValidLatLon(91, 0)).toBe(false);
    expect(isValidLatLon(0, -180.01)).toBe(false);
    expect(isValidLatLon(NaN, 0)).toBe(false);
    expect(isValidLatLon(null, undefined)).toBe(false);
  });
});
