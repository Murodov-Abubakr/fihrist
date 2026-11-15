import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from 'framer-motion';
import type { Analysis } from '../data/useRotations';
import { ROTATION_IDS } from '../data/useRotations';
import type { PlantingCrop, RotationId } from '../engine/rotation';
import { ROTATION_COLOR } from '../lib/palette';
import { polygonCentroid } from '../lib/field';
import { MAX_PLOTS, pointInPolygon, splitStrips, squareRing, toLocal, toLonLat, type XY } from '../lib/plots';
import { useStore } from '../state';

const fmt = (v: number, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const WHITE: [number, number, number] = [242, 239, 234];
const GREY: [number, number, number] = [201, 206, 214];
const SOILC: [number, number, number] = [200, 162, 122];
const MONTHS_SHOWN = 36;

/** Crop in the ground for a rotation in a given month of the 3-year view (dominant crop; null = bare soil). */
function cropAt(analysis: Analysis, id: RotationId, monthIdx: number): { crop: PlantingCrop | null; live: number } {
  const cal = analysis.results[id].calendar;
  if (!cal.length) return { crop: null, live: 0 };
  const mc = cal[Math.floor(monthIdx / 12) % cal.length][monthIdx % 12];
  if (!mc || mc.live < 0.25 || !mc.crops.length) return { crop: null, live: mc?.live ?? 0 };
  const top = mc.crops.reduce((a, b) => (b.share > a.share ? b : a));
  return { crop: top.crop, live: mc.live };
}

/**
 * The farmer's outlined field in 3D, split into up to four equal-area plots. Each plot gets one of the three
 * rotations; a month slider (or play) shows which crop is in the ground on each plot over three years.
 * Whole-field totals of the plan = Σ plot area × the rotation's per-hectare replay means (plots independent).
 */
export function FieldPlots3D({ analysis }: { analysis: Analysis | null }) {
  const { t } = useTranslation();
  const { state } = useStore();
  const reduce = useReducedMotion();
  const [nPlots, setNPlots] = useState(3);
  const [plan, setPlan] = useState<RotationId[]>(['baseline', 'waterSaving', 'regenerative', 'regenerative']);
  const [sel, setSel] = useState(0);
  const [month, setMonth] = useState(5);
  const [playing, setPlaying] = useState(!reduce);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const example = !state.field;
  const geo = useMemo(() => {
    const ring = state.field?.ring ?? squareRing({ lat: state.lat, lon: state.lon }, 1);
    const center = state.field?.centroid ?? polygonCentroid(ring);
    const local = toLocal(ring, center);
    const extent = Math.max(...local.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1])))) || 1;
    const strips = splitStrips(local, nPlots);
    // planting grid in each plot (deterministic jitter)
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const step = (extent * 2) / 19;
    const pts = strips.map((s) => {
      const out: XY[] = [];
      const xs = s.poly.map((p) => p[0]), ys = s.poly.map((p) => p[1]);
      for (let x = Math.min(...xs) + step / 2; x < Math.max(...xs); x += step) {
        for (let y = Math.min(...ys) + step / 2; y < Math.max(...ys); y += step * 0.8) {
          const p: XY = [x + (rnd() - 0.5) * step * 0.3, y + (rnd() - 0.5) * step * 0.3];
          if (pointInPolygon(p, s.poly)) out.push([p[0] / extent, p[1] / extent]);
        }
      }
      return out;
    });
    return {
      ring, center, extent,
      outline: local.map((p) => [p[0] / extent, p[1] / extent] as XY),
      plots: strips.map((s, i) => ({ ...s, norm: s.poly.map((p) => [p[0] / extent, p[1] / extent] as XY), pts: pts[i] })),
    };
  }, [state.field, state.lat, state.lon, nPlots]);

  // auto-play the 36-month view
  useEffect(() => {
    if (!playing || reduce) return;
    const id = window.setInterval(() => setMonth((m) => (m + 1) % MONTHS_SHOWN), 650);
    return () => window.clearInterval(id);
  }, [playing, reduce]);
  useEffect(() => { if (sel >= nPlots) setSel(0); }, [nPlots, sel]);

  // latest values for the render loop
  const hasAnalysis = !!analysis;
  const live = useRef({ geo, plan, sel, month, analysis, nPlots });
  live.current = { geo, plan, sel, month, analysis, nPlots };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let W = 0, H = 0, yaw = -0.6, drag: { x: number; yaw: number; moved: boolean } | null = null, raf = 0, visible = true, lastUser = -1e9;
    const pitch = 0.62, D = 6;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const S = () => Math.min(W * 0.27, H * 0.42);
    const project = (x: number, y: number, z: number): [number, number, number] => {
      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const X = x * cy - z * sy, Z0 = x * sy + z * cy;
      const Y = y * Math.cos(pitch) + Z0 * Math.sin(pitch), Z = Z0 * Math.cos(pitch) - y * Math.sin(pitch);
      const f = D / (D + Z), s = S();
      return [W / 2 + X * s * f, H * 0.5 - Y * s * f, f];
    };
    // field coordinates: x = east, z = north, y = up
    const P = (p: XY, h = 0) => project(p[0], h, p[1]);
    const line = (a: number[], b: number[], c: [number, number, number], al: number, w = 1) => {
      ctx.strokeStyle = rgba(c, al); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    };
    const dot = (p: number[], r: number, c: [number, number, number], al: number) => { ctx.fillStyle = rgba(c, al); ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 6.2832); ctx.fill(); };
    const poly = (ps: number[][]) => { ctx.beginPath(); ps.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); };

    const draw = (time: number) => {
      const { geo: g, plan: pl, sel: sl, month: mo, analysis: an } = live.current;
      if (!drag && !reduce && time - lastUser > 4000) yaw += 0.0012;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      // projector rings under the field
      const rings: { r: number; c: [number, number, number]; al: number; dash: number[] }[] = [
        { r: 1.45, c: GREY, al: 0.16, dash: [] },
        { r: 1.28, c: hex('#C98B66'), al: 0.32, dash: [2, 6] },
      ];
      for (const { r, c, al, dash } of rings) {
        ctx.setLineDash(dash); ctx.strokeStyle = rgba(c, al); ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 0; i <= 96; i++) { const a = (i / 96) * 6.2832; const p = project(Math.cos(a) * r, -0.25, Math.sin(a) * r); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
        ctx.stroke(); ctx.setLineDash([]);
      }
      // plots: fill, outline, crops
      g.plots.forEach((p, i) => {
        const id = pl[i];
        const col = hex(ROTATION_COLOR[id]);
        const isSel = i === sl;
        const ps = p.norm.map((q) => P(q));
        poly(ps); ctx.fillStyle = rgba(col, isSel ? 0.2 : 0.09); ctx.fill();
        ctx.strokeStyle = rgba(isSel ? WHITE : col, isSel ? 0.9 : 0.55); ctx.lineWidth = isSel ? 1.6 : 1; ctx.stroke();
        const { crop, live: lv } = an ? cropAt(an, id, mo) : { crop: null, live: 0 };
        const grow = 0.45 + 0.55 * Math.min(1, lv);
        for (const q of p.pts) {
          const b = P(q);
          const al = (isSel ? 0.75 : 0.5) * (0.4 + 0.6 * Math.min(1, (b[2] - 0.8) / 0.4 + 0.5));
          if (!crop) { dot(b, 0.9, SOILC, al * 0.6); continue; }
          const sway = 0.008 * Math.sin(time / 700 + q[0] * 6 + q[1] * 4);
          const h = { wheat: 0.12, barley: 0.11, cover: 0.05, chickpea: 0.06, mung: 0.06, potato: 0.04, cotton: 0.09, sorghum: 0.16, maize: 0.18 }[crop] * grow;
          const top = P([q[0] + sway, q[1]], h);
          line(b, top, col, al, crop === 'maize' || crop === 'sorghum' ? 1.3 : 1);
          if (crop === 'wheat' || crop === 'barley') line(top, P([q[0] + sway * 1.2, q[1]], h * 1.18), WHITE, al, 2);
          else if (crop === 'chickpea' || crop === 'mung' || crop === 'potato') { dot(P([q[0] + sway, q[1]], h * 0.6), 1.6, col, al); dot(top, 1.9, col, al + 0.1); }
          else if (crop === 'cotton') dot(top, 2.2, WHITE, al + 0.1);
          else if (crop === 'sorghum' || crop === 'maize') dot(top, 2.1, WHITE, al * 0.9);
        }
      });
      // field outline + corner markers
      ctx.globalCompositeOperation = 'source-over';
      const outline = g.outline.map((q) => P(q));
      poly(outline); ctx.strokeStyle = rgba(WHITE, 0.55); ctx.lineWidth = 1; ctx.stroke();
      ctx.font = '500 10px "Exo 2", Inter, sans-serif'; ctx.textBaseline = 'middle';
      g.outline.forEach((q, i) => {
        const p = outline[i];
        line(p, P(q, 0.12), WHITE, 0.6);
        dot(P(q, 0.12), 2.2, WHITE, 0.9);
        if (W > 520 && g.outline.length <= 8) {
          const [lon, lat] = g.ring[i];
          const right = p[0] > W * 0.62;
          ctx.fillStyle = rgba(GREY, 0.8); ctx.textAlign = right ? 'right' : 'left';
          ctx.fillText(`${lat.toFixed(5)}°, ${lon.toFixed(5)}°`, p[0] + (right ? -6 : 6), P(q, 0.12)[1] - 2);
        }
      });
      // plot numbers
      g.plots.forEach((p, i) => {
        const c = p.norm.reduce((a, q) => [a[0] + q[0] / p.norm.length, a[1] + q[1] / p.norm.length], [0, 0]);
        const m = P(c as XY, 0.32);
        ctx.fillStyle = i === sl ? rgba(WHITE, 1) : rgba(GREY, 0.85); ctx.textAlign = 'center';
        ctx.font = '600 12px "Exo 2", Inter, sans-serif';
        ctx.fillText(String(i + 1), m[0], m[1]);
      });
      // north arrow
      const n0 = P([0, 1.25], 0), n1 = P([0, 1.45], 0);
      line(n0, n1, hex('#C98B66'), 0.9, 1.5);
      ctx.fillStyle = rgba(hex('#E8B391'), 0.95); ctx.font = '600 11px "Exo 2", Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('N', n1[0], n1[1] - 9);
    };
    // ~24 fps is enough for slow sway and turning, and keeps phones (and the rest of the page) responsive
    let lastDraw = -1e9;
    const loop = (time: number) => {
      if (time - lastDraw >= 41 || drag) { draw(time); lastDraw = time; }
      raf = requestAnimationFrame(loop);
    };
    const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    // drag to turn, click to select a plot
    const down = (e: PointerEvent) => { drag = { x: e.clientX, yaw, moved: false }; canvas.setPointerCapture(e.pointerId); lastUser = performance.now(); };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 3) drag.moved = true;
      yaw = drag.yaw + dx * 0.008; lastUser = performance.now();
    };
    const up = (e: PointerEvent) => {
      if (drag && !drag.moved) {
        const r = canvas.getBoundingClientRect();
        const pt: XY = [e.clientX - r.left, e.clientY - r.top];
        const { geo: g } = live.current;
        for (let i = g.plots.length - 1; i >= 0; i--) {
          const scr = g.plots[i].norm.map((q) => { const p = P(q); return [p[0], p[1]] as XY; });
          if (pointInPolygon(pt, scr)) { setSel(i); break; }
        }
      }
      drag = null;
    };
    resize();
    const ro = new ResizeObserver(() => { resize(); if (reduce) draw(0); });
    ro.observe(canvas);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', () => { drag = null; });
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVis);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else stop(); });
    io.observe(canvas);
    start();
    return () => { stop(); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); };
    // the canvas only exists once results are ready, so (re)attach when that changes
  }, [reduce, hasAnalysis]);

  if (!analysis) return null;
  const rainfed = analysis.irrigation === 'rainfed';
  const months = t('months', { returnObjects: true }) as string[];
  const per = (id: RotationId) => {
    const m = analysis.results[id].mean;
    return { water: rainfed ? m.unmetM3 : m.grossIrrigationM3, people: m.peopleFed, profit: m.trueProfitUsd };
  };
  const plotsUsed = geo.plots.map((p, i) => ({ ...p, id: plan[i] }));
  const total = plotsUsed.reduce((a, p) => { const v = per(p.id); return { water: a.water + v.water * p.areaHa, people: a.people + v.people * p.areaHa, profit: a.profit + v.profit * p.areaHa }; }, { water: 0, people: 0, profit: 0 });
  const areaHa = plotsUsed.reduce((a, p) => a + p.areaHa, 0);
  const base = per('baseline');
  const delta = { water: total.water - base.water * areaHa, people: total.people - base.people * areaHa, profit: total.profit - base.profit * areaHa };
  const sign = (v: number, d = 0) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt(Math.abs(v), d)}`;
  const cropName = (c: PlantingCrop | null) => (c === null ? t('plots3d.bare') : c === 'cover' ? t('crops.coverOnly') : t(`crops.${c}`));
  const selPlot = plotsUsed[Math.min(sel, plotsUsed.length - 1)];

  return (
    <section className="slab relative z-10 p-4 sm:p-5" aria-labelledby="plots3d-h">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="plots3d-h" className="title-caps text-base">{t('plots3d.title')}</h2>
        <span className="num text-xs text-slate">{fmt(areaHa, areaHa < 10 ? 2 : 1)} ha · {geo.center.lat.toFixed(5)}°, {geo.center.lon.toFixed(5)}°</span>
      </div>
      <p className="mb-3 text-[12px] leading-snug text-slate">{example ? t('plots3d.example') : t('plots3d.intro')}</p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="relative overflow-hidden rounded-md border border-white/[0.07] bg-black/30">
          <canvas
            ref={canvasRef}
            className="block h-[300px] w-full cursor-grab touch-none active:cursor-grabbing sm:h-[380px]"
            role="img"
            aria-label={t('plots3d.canvasLabel', { n: plotsUsed.length, month: months[month % 12], year: Math.floor(month / 12) + 1 })}
          />
          <p className="pointer-events-none absolute left-3 top-2 text-[10px] uppercase tracking-[0.18em] text-slate">{t('plots3d.dragHint')}</p>
          <div className="absolute bottom-2 left-3 right-3 flex items-center gap-3">
            <button type="button" className="keycap" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>{playing ? t('plots3d.pause') : t('plots3d.play')}</button>
            <input
              type="range" className="range" min={0} max={MONTHS_SHOWN - 1} step={1} value={month}
              style={{ ['--fill' as string]: `${(month / (MONTHS_SHOWN - 1)) * 100}%` }}
              onChange={(e) => { setPlaying(false); setMonth(Number(e.target.value)); }}
              aria-label={t('plots3d.monthLabel')}
              aria-valuetext={t('plots3d.month', { y: Math.floor(month / 12) + 1, m: months[month % 12] })}
            />
            <span className="num min-w-[88px] text-right text-xs text-parchment">{t('plots3d.month', { y: Math.floor(month / 12) + 1, m: months[month % 12] })}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <div className="eyebrow mb-2">{t('plots3d.plots')}</div>
            <div className="flex gap-2" role="group" aria-label={t('plots3d.plots')}>
              {Array.from({ length: MAX_PLOTS }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" className="chip !px-3 !py-1" aria-pressed={nPlots === n} onClick={() => setNPlots(n)}>{n}</button>
              ))}
            </div>
          </div>

          <ul className="space-y-1.5">
            {plotsUsed.map((p, i) => {
              const { crop } = cropAt(analysis, p.id, month);
              return (
                <li key={i}>
                  <button type="button" onClick={() => setSel(i)} aria-pressed={sel === i}
                    className={`flex w-full items-center gap-2 rounded-md border px-3 py-1.5 text-left text-xs transition-colors ${sel === i ? 'border-white/70 bg-white/[0.06]' : 'border-white/10 hover:border-white/30'}`}>
                    <span className="num w-4 text-slate">{i + 1}</span>
                    <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: ROTATION_COLOR[p.id] }} />
                    <span className="min-w-0 flex-1 truncate text-parchment">{t(`rotations.${p.id}`)}</span>
                    <span className="truncate text-slate">{cropName(crop)}</span>
                    <span className="num text-slate">{fmt(p.areaHa, p.areaHa < 10 ? 2 : 1)} ha</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {selPlot && (
            <div>
              <div className="eyebrow mb-2">{t('plots3d.assign', { n: Math.min(sel, plotsUsed.length - 1) + 1 })}</div>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t('plots3d.assign', { n: sel + 1 })}>
                {ROTATION_IDS.map((id) => (
                  <button key={id} type="button" className="chip !px-3 !py-1 text-xs" aria-pressed={plan[sel] === id}
                    onClick={() => setPlan((pl) => pl.map((v, j) => (j === sel ? id : v)))}>
                    <span aria-hidden className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: ROTATION_COLOR[id] }} />{t(`rotations.${id}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-md border border-white/10 bg-black/20 p-3">
            <div className="eyebrow mb-2">{t('plots3d.totals')}</div>
            <dl className="num grid grid-cols-3 gap-2 text-xs">
              <div><dt className="font-sans text-[10.5px] text-slate">{rainfed ? t('field.waterRainfed') : t('field.water')}</dt><dd className="text-parchment">{fmt(total.water)} m³</dd><dd className="text-[10.5px] text-slate">{sign(delta.water)}</dd></div>
              <div><dt className="font-sans text-[10.5px] text-slate">{t('field.people')}</dt><dd className="text-parchment">{fmt(total.people, 1)}</dd><dd className="text-[10.5px] text-slate">{sign(delta.people, 1)}</dd></div>
              <div><dt className="font-sans text-[10.5px] text-slate">{t('field.profit')}</dt><dd className="text-parchment">{fmt(total.profit)} USD</dd><dd className="text-[10.5px] text-slate">{sign(delta.profit)}</dd></div>
            </dl>
            <p className="mt-2 text-[10.5px] leading-snug text-slate">{t('plots3d.vsBaseline')}</p>
          </div>
        </div>
      </div>

      <details className="mt-3 text-xs text-slate">
        <summary className="cursor-pointer text-parchment">{t('plots3d.coords')}</summary>
        <ol className="num mt-2 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
          {geo.ring.map(([lon, lat], i) => <li key={i}>{i + 1}. {lat.toFixed(6)}°, {lon.toFixed(6)}°</li>)}
        </ol>
        {plotsUsed.length > 1 && (
          <ol className="num mt-2 space-y-0.5">
            {plotsUsed.map((p, i) => {
              const c = toLonLat(p.poly.reduce((a, q) => [a[0] + q[0] / p.poly.length, a[1] + q[1] / p.poly.length], [0, 0]) as XY, geo.center);
              return <li key={i}>{t('plots3d.plotCenter', { n: i + 1 })}: {c[1].toFixed(6)}°, {c[0].toFixed(6)}° · {fmt(p.areaHa, 2)} ha</li>;
            })}
          </ol>
        )}
      </details>
      <p className="mt-2 text-[10.5px] leading-snug text-slate">{t('plots3d.note')}</p>
    </section>
  );
}
