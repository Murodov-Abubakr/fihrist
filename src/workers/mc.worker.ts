/// <reference lib="webworker" />
/**
 * Local Compute Grid node: runs one Monte Carlo batch off the main thread.
 * Same engine code as the Cloudflare Function (src/engine/montecarlo.ts).
 * Input is validated exactly like a network request (OWASP A08).
 */
import { runBatch, validateSimulateRequest } from '../engine/montecarlo.ts';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent) => {
  const nodeId = typeof e.data?.nodeId === 'number' ? e.data.nodeId : -1;
  try {
    const req = validateSimulateRequest(e.data);
    const t0 = performance.now();
    const results = runBatch(req.payload, req.runs, req.seed);
    self.postMessage({ ok: true, nodeId: req.nodeId, runs: req.runs, cpuMs: performance.now() - t0, results });
  } catch (err) {
    self.postMessage({ ok: false, nodeId, error: (err as Error).message.slice(0, 120) });
  }
};
