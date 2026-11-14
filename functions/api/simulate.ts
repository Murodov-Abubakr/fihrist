/**
 * Cloudflare Pages Function — POST /api/simulate
 * One Fihrist Compute Grid batch: runs N Monte Carlo decades from precomputed season tables.
 * Shares the engine with the browser (src/engine/montecarlo.ts).
 *
 * Security (OWASP):
 *  A01  same-origin only (Origin must match; no CORS headers emitted); POST only
 *  A03/A08  body size-capped, JSON-parsed, strictly validated before use
 *  A04  ≤ 500 runs per request; season tables make a batch ~1 ms of CPU (Workers free plan: 10 ms)
 *  A05  no stack traces in responses; nosniff + no-store
 *  A09  structured log line on rejection (no IP, no body)
 *  A10  no outbound requests at all
 *
 * Note: Workers freeze timers during CPU execution (timing side-channel mitigation), so CPU time
 * cannot be measured from inside; we report cpuMs = null and the client measures round-trip time.
 */
import { MC_LIMITS, McPayloadError, runBatch, validateSimulateRequest } from '../../src/engine/montecarlo';

interface Ctx { request: Request & { cf?: { colo?: string } } }

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });

const reject = (status: number, reason: string) => {
  console.log(JSON.stringify({ evt: 'simulate_rejected', status, reason }));
  return json(status, { ok: false, error: reason });
};

export const onRequestPost = async ({ request }: Ctx): Promise<Response> => {
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return reject(403, 'cross-origin request');
  if (!(request.headers.get('Content-Type') ?? '').startsWith('application/json')) return reject(415, 'json required');
  const declared = Number(request.headers.get('Content-Length') ?? 0);
  if (declared > MC_LIMITS.maxPayloadBytes) return reject(413, 'payload too large');

  const text = await request.text();
  if (text.length > MC_LIMITS.maxPayloadBytes) return reject(413, 'payload too large');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reject(400, 'invalid json');
  }
  try {
    const req = validateSimulateRequest(body);
    const results = runBatch(req.payload, req.runs, req.seed);
    return json(200, { ok: true, nodeId: req.nodeId, colo: request.cf?.colo ?? null, runs: req.runs, cpuMs: null, results });
  } catch (e) {
    return reject(400, e instanceof McPayloadError ? e.message : 'invalid request');
  }
};
