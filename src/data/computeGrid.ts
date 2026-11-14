/**
 * Fihrist Compute Grid client.
 * Splits a Monte Carlo simulation into N batches and runs them in parallel:
 *   1. Cloudflare edge: POST /api/simulate (each response reports the real data-centre code, cf.colo)
 *   2. Fallback per batch: browser Web Workers ("local fallback") if the endpoint fails, times out,
 *      is absent (local preview) or returns an invalid result.
 * Every number in the telemetry is measured — nothing is simulated or animated for show.
 */
import { MC_LIMITS, summarize, validateBatchResult, type BatchResult, type McPayload, type McSummary } from '../engine/montecarlo.ts';

export interface NodeReport {
  nodeId: number;
  mode: 'edge' | 'local';
  colo: string | null; // Cloudflare data-centre code (edge only)
  worker?: number; // local worker index
  runs: number;
  wallMs: number; // measured round trip (edge) or worker time (local)
  cpuMs: number | null; // measured inside the worker; null at the edge (timers frozen in Workers)
  ok: boolean;
  error?: string;
}

export interface GridResult { summary: McSummary; nodes: NodeReport[]; wallMs: number }

const EDGE_TIMEOUT_MS = 8000;
let edgeKnownMissing = false; // remember a 404 so we don't hammer a missing endpoint
let probeInFlight: Promise<void> | null = null; // one shared edge probe across concurrent simulations

/* ───────────── local worker pool ───────────── */
let pool: Worker[] = [];
function getPool(size: number): Worker[] {
  while (pool.length < size) pool.push(new Worker(new URL('../workers/mc.worker.ts', import.meta.url), { type: 'module' }));
  return pool.slice(0, size);
}

function runOnWorker(w: Worker, msg: { nodeId: number; runs: number; seed: number; payload: McPayload }, workerIdx: number): Promise<{ report: NodeReport; result?: BatchResult }> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const onMsg = (e: MessageEvent) => {
      if (e.data?.nodeId !== msg.nodeId) return; // another batch's reply on a shared worker
      w.removeEventListener('message', onMsg);
      const wallMs = performance.now() - t0;
      try {
        if (!e.data.ok) throw new Error(e.data.error ?? 'worker error');
        const result = validateBatchResult(e.data.results, msg.runs);
        resolve({ report: { nodeId: msg.nodeId, mode: 'local', colo: null, worker: workerIdx, runs: msg.runs, wallMs, cpuMs: e.data.cpuMs, ok: true }, result });
      } catch (err) {
        resolve({ report: { nodeId: msg.nodeId, mode: 'local', colo: null, worker: workerIdx, runs: msg.runs, wallMs, cpuMs: null, ok: false, error: (err as Error).message } });
      }
    };
    w.addEventListener('message', onMsg);
    w.postMessage(msg);
  });
}

async function runOnEdge(msg: { nodeId: number; runs: number; seed: number; payload: McPayload }, signal: AbortSignal): Promise<{ report: NodeReport; result?: BatchResult }> {
  const t0 = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), EDGE_TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal.addEventListener('abort', onAbort);
  try {
    const res = await fetch('/api/simulate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(msg),
      signal: ctrl.signal, credentials: 'same-origin', redirect: 'error',
    });
    if (res.status === 404 || res.status === 405) edgeKnownMissing = true;
    if (!res.ok) throw new Error(`edge ${res.status}`);
    const body = await res.json();
    const result = validateBatchResult(body?.results, msg.runs);
    // On a local dev server the Function runs on this machine; never show a data-centre code there.
    const isDev = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    const colo = isDev ? 'DEV' : typeof body.colo === 'string' && /^[A-Z]{3}$/.test(body.colo) ? body.colo : null;
    return { report: { nodeId: msg.nodeId, mode: 'edge', colo, runs: msg.runs, wallMs: performance.now() - t0, cpuMs: null, ok: true }, result };
  } catch (err) {
    return { report: { nodeId: msg.nodeId, mode: 'edge', colo: null, runs: msg.runs, wallMs: performance.now() - t0, cpuMs: null, ok: false, error: (err as Error).message } };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

/**
 * Runs `totalRuns` decades in `batches` parallel batches. `onNode` streams each finished node so the
 * panel can light up as real results arrive.
 */
export async function runComputeGrid(
  payload: McPayload,
  opts: { totalRuns?: number; batches?: number; seed?: number; signal?: AbortSignal; onNode?: (r: NodeReport) => void } = {},
): Promise<GridResult> {
  const batches = Math.min(opts.batches ?? 12, MC_LIMITS.maxBatches);
  const totalRuns = Math.min(opts.totalRuns ?? 2400, MC_LIMITS.maxTotalRuns);
  const per = Math.ceil(totalRuns / batches);
  const baseSeed = (opts.seed ?? 20261115) >>> 0;
  const signal = opts.signal ?? new AbortController().signal;
  const workers = getPool(Math.max(1, Math.min(batches, navigator.hardwareConcurrency || 4, 12)));
  const t0 = performance.now();

  const msgs = Array.from({ length: batches }, (_, i) => ({ nodeId: i, runs: Math.min(per, totalRuns - per * i), seed: (baseSeed + i * 7919) >>> 0, payload }))
    .filter((m) => m.runs > 0);

  const finish = (out: { report: NodeReport; result?: BatchResult }) => {
    if (!signal.aborted) opts.onNode?.(out.report);
    return out;
  };
  const local = async (msg: (typeof msgs)[number]) => {
    const wi = msg.nodeId % workers.length;
    return finish(await runOnWorker(workers[wi], msg, wi)); // local fallback
  };
  const edgeOrLocal = async (msg: (typeof msgs)[number]) => {
    const out = await runOnEdge(msg, signal);
    return out.result ? finish(out) : local(msg);
  };

  // Probe with the first batch: if the edge endpoint answers, fan the rest out to it;
  // otherwise run everything locally (avoids N failing requests when /api/simulate is absent).
  // Concurrent simulations wait for one shared in-flight probe instead of each sending their own.
  if (probeInFlight) await probeInFlight.catch(() => undefined);
  let done: { report: NodeReport; result?: BatchResult }[];
  if (edgeKnownMissing) {
    done = await Promise.all(msgs.map(local));
  } else {
    const probing = runOnEdge(msgs[0], signal);
    probeInFlight = probing.then(() => undefined);
    const probe = await probing;
    probeInFlight = null;
    if (probe.result) {
      done = [finish(probe), ...(await Promise.all(msgs.slice(1).map(edgeOrLocal)))];
    } else {
      done = await Promise.all(msgs.map(local)); // runOnEdge already remembered a 404/405
    }
  }
  const ok = done.filter((d) => d.result).map((d) => d.result!);
  if (!ok.length) throw new Error('all compute nodes failed');
  return { summary: summarize(ok), nodes: done.map((d) => d.report), wallMs: performance.now() - t0 };
}
