/**
 * Tests the real Cloudflare Pages Function (functions/api/simulate.ts) with standard Request objects.
 * (wrangler's local workerd runtime does not start on this Windows build, so the handler is exercised directly.)
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { onRequestPost } from '../functions/api/simulate';
import { buildSeasonTables, deriveForMc, validateBatchResult } from './engine/montecarlo';

const s = JSON.parse(readFileSync(join(__dirname, '../public/data/presets/gissar.json'), 'utf8')).series;
const { series, dd } = deriveForMc(s, 0, 0);
const payload = buildSeasonTables(series, dd, { irrigation: 'canal', region: 'centralAsia', baseline: 'wheat' });
const URL_ = 'https://fihrist.example/api/simulate';

function req(body: unknown, headers: Record<string, string> = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const r = new Request(URL_, { method: 'POST', body: text, headers: { 'Content-Type': 'application/json', Origin: 'https://fihrist.example', ...headers } });
  return Object.assign(r, { cf: { colo: 'FRA' } });
}
vi.spyOn(console, 'log').mockImplementation(() => {}); // rejection logs are expected

describe('POST /api/simulate', () => {
  it('runs a valid batch and reports the data-centre code', async () => {
    const res = await onRequestPost({ request: req({ nodeId: 3, runs: 200, seed: 42, payload }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull(); // same-origin only
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, nodeId: 3, colo: 'FRA', runs: 200, cpuMs: null });
    expect(() => validateBatchResult(body.results, 200)).not.toThrow();
  });
  it('payload fits comfortably under the body limit', () => {
    expect(JSON.stringify({ nodeId: 0, runs: 200, seed: 1, payload }).length).toBeLessThan(150_000);
  });
  it.each([
    ['cross-origin', () => req({ nodeId: 0, runs: 10, seed: 1, payload }, { Origin: 'https://evil.example' }), 403],
    ['non-JSON content type', () => req({ nodeId: 0, runs: 10, seed: 1, payload }, { 'Content-Type': 'text/plain' }), 415],
    ['oversized body', () => req('x'.repeat(200_000)), 413],
    ['broken JSON', () => req('{"nodeId":'), 400],
    ['too many runs (resource exhaustion)', () => req({ nodeId: 0, runs: 100_000, seed: 1, payload }), 400],
    ['poisoned table', () => req({ nodeId: 0, runs: 10, seed: 1, payload: { ...payload, rotations: [] } }), 400],
    ['prototype-pollution body', () => req('{"__proto__":{"polluted":1},"nodeId":0,"runs":10,"seed":1}'), 400],
  ])('rejects %s', async (_l, make, status) => {
    const res = await onRequestPost({ request: make() });
    expect(res.status).toBe(status);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/at .*\.ts|stack/i); // no stack traces leak
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
