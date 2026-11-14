import { useTranslation } from 'react-i18next';
import type { McState } from '../data/useMonteCarlo';
import type { NodeReport } from '../data/computeGrid';
import { SectionTitle } from './SectionTitle';

/** Live panel of Compute Grid nodes. Shows only measured values; tiles light up as real results arrive. */
export function ComputeGridPanel({ mc }: { mc: McState }) {
  const { t } = useTranslation();
  if (mc.status === 'idle') return null;
  if (mc.status === 'error') return <p className="text-xs text-terracotta-light">{t('grid.error', { msg: mc.message })}</p>;

  const nodes = mc.nodes;
  const byId = new Map<number, NodeReport>(nodes.map((n) => [n.nodeId, n]));
  const edge = nodes.filter((n) => n.mode === 'edge' && n.ok).length;
  const local = nodes.filter((n) => n.mode === 'local' && n.ok).length;

  return (
    <section className="space-y-3">
      <SectionTitle>{t('grid.title')}</SectionTitle>
      <div className="slab p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2 text-xs">
          <span className="num text-parchment">
            {mc.status === 'done'
              ? t('grid.done', { runs: mc.runs.toLocaleString('en-US'), batches: mc.batches, ms: Math.round(mc.wallMs) })
              : t('grid.running', { runs: mc.runs.toLocaleString('en-US') })}
          </span>
          <span className="num text-slate">
            {t('grid.edge')}: {edge} · {t('grid.local')}: {local}
            {mc.status === 'done' && <> · {t('grid.tables', { ms: Math.round(mc.tableMs) })}</>}
          </span>
        </div>
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: mc.batches }, (_, i) => {
            const n = byId.get(i);
            const label = !n ? t('grid.pending') : !n.ok ? t('grid.failed') : n.mode === 'edge' ? n.colo ?? 'EDGE' : `LOCAL · W${(n.worker ?? 0) + 1}`;
            const lit = n?.ok;
            return (
              <li
                key={i}
                className={`rounded-lg border px-2.5 py-2 transition-all duration-300 ${
                  !n ? 'border-white/10 bg-black/20 text-slate' : !n.ok ? 'border-terracotta/60 text-terracotta-light' : 'border-white bg-pill text-ink shadow-select'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="num text-[10px] opacity-70">#{String(i + 1).padStart(2, '0')}</span>
                  {lit && <span className={`h-1.5 w-1.5 rounded-full ${n.mode === 'edge' ? 'bg-verdigris' : 'bg-brass'}`} />}
                </div>
                <div className="num mt-0.5 truncate text-sm font-medium">{label}</div>
                {n?.ok && (
                  <div className="num text-[10px] opacity-75">
                    {n.runs} · {Math.round(n.cpuMs ?? n.wallMs)} ms
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-[11px] leading-relaxed text-slate">{t('grid.how')}</p>
        <p className="text-[11px] leading-relaxed text-slate">{t('grid.cpuNote')}</p>
      </div>
    </section>
  );
}
