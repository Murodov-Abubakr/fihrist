import { useEffect, useMemo, useState } from 'react';
import { buildSeasonTables, type McSummary } from '../engine/montecarlo.ts';
import type { RegionId } from '../engine/params.ts';
import type { Irrigation } from '../engine/rotation.ts';
import { runComputeGrid, type NodeReport } from './computeGrid.ts';
import type { Derived } from './useDerived.ts';

export type McState =
  | { status: 'idle' }
  | { status: 'running'; nodes: NodeReport[]; batches: number; runs: number }
  | { status: 'done'; summary: McSummary; nodes: NodeReport[]; wallMs: number; tableMs: number; batches: number; runs: number }
  | { status: 'error'; message: string };

export const MC_RUNS = 2400;
export const MC_BATCHES = 12;

/** Builds season tables (main thread) then runs the Compute Grid; restarts when inputs change. */
export function useMonteCarlo(derived: Derived | null, irrigation: Irrigation, baseline: 'wheat' | 'wheatCotton', region: RegionId | null): McState {
  const [state, setState] = useState<McState>({ status: 'idle' });

  const tables = useMemo(() => {
    if (!derived || !region) return null;
    const t0 = performance.now();
    const payload = buildSeasonTables(derived.series, derived.dd, { irrigation, region, baseline });
    return { payload, ms: performance.now() - t0 };
  }, [derived, irrigation, baseline, region]);

  useEffect(() => {
    if (!tables) { setState({ status: 'idle' }); return; }
    const ctrl = new AbortController();
    const nodes: NodeReport[] = [];
    setState({ status: 'running', nodes: [], batches: MC_BATCHES, runs: MC_RUNS });
    runComputeGrid(tables.payload, {
      totalRuns: MC_RUNS, batches: MC_BATCHES, signal: ctrl.signal,
      onNode: (r) => { nodes.push(r); if (!ctrl.signal.aborted) setState({ status: 'running', nodes: [...nodes], batches: MC_BATCHES, runs: MC_RUNS }); },
    })
      .then((g) => { if (!ctrl.signal.aborted) setState({ status: 'done', summary: g.summary, nodes: g.nodes, wallMs: g.wallMs, tableMs: tables.ms, batches: MC_BATCHES, runs: g.summary.runs }); })
      .catch((e: Error) => { if (!ctrl.signal.aborted) setState({ status: 'error', message: e.message }); });
    return () => ctrl.abort();
  }, [tables]);

  return state;
}
