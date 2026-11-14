import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/** Deterministic PRNG so the decoration is identical on every render. */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Orbit {
  r: number;
  period: number; // seconds per revolution
  dir: 1 | -1;
  phase: number; // degrees
  planet: number; // planet radius
  color: string;
  copper?: boolean; // orbit drawn as copper dashed ring
  moon?: boolean;
}
interface System { x: number; y: number; star: number; orbits: Orbit[]; ticks?: boolean }

const W = 1600;
const H = 1000;
const GREY = '#C9CED6';
const COPPER = '#C98B66';
const PLANET_LIGHT = '#ECE8E1';

/** Hand-placed small solar systems across a 1600×1000 star map. */
const SYSTEMS: System[] = [
  { x: -60, y: 160, star: 5, ticks: true, orbits: [
    { r: 230, period: 140, dir: 1, phase: 20, planet: 4, color: COPPER, copper: true },
    { r: 360, period: 220, dir: 1, phase: 70, planet: 3, color: PLANET_LIGHT },
    { r: 520, period: 320, dir: -1, phase: 40, planet: 5, color: GREY, moon: true },
  ] },
  { x: 1340, y: 720, star: 4, orbits: [
    { r: 64, period: 34, dir: 1, phase: 0, planet: 2.5, color: PLANET_LIGHT },
    { r: 118, period: 62, dir: 1, phase: 140, planet: 3.5, color: COPPER },
    { r: 186, period: 110, dir: -1, phase: 260, planet: 4.5, color: GREY, moon: true },
    { r: 262, period: 180, dir: 1, phase: 60, planet: 3, color: COPPER, copper: true },
  ] },
  { x: 1040, y: 210, star: 3, orbits: [
    { r: 46, period: 28, dir: -1, phase: 90, planet: 2.2, color: PLANET_LIGHT },
    { r: 92, period: 70, dir: -1, phase: 200, planet: 3, color: GREY },
    { r: 150, period: 130, dir: 1, phase: 320, planet: 2.5, color: COPPER, copper: true },
  ] },
  { x: 330, y: 840, star: 3, orbits: [
    { r: 40, period: 24, dir: 1, phase: 30, planet: 2, color: COPPER },
    { r: 78, period: 52, dir: 1, phase: 180, planet: 3, color: PLANET_LIGHT },
    { r: 124, period: 96, dir: -1, phase: 300, planet: 2.5, color: GREY },
  ] },
  { x: 690, y: 520, star: 2, orbits: [
    { r: 30, period: 20, dir: -1, phase: 0, planet: 1.8, color: PLANET_LIGHT },
    { r: 58, period: 44, dir: 1, phase: 120, planet: 2.2, color: COPPER },
  ] },
];

/** Static layer: stone, grain, hairlines, stars, orbit rings. Painted once, never animated. */
function StaticLayer() {
  const stars = useMemo(() => {
    const r = mulberry32(77);
    return Array.from({ length: 120 }, () => ({ x: r() * W, y: r() * H, s: 0.3 + r() * 0.9, o: 0.15 + r() * 0.45 }));
  }, []);
  return (
    <svg aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="stoneLight" cx="55%" cy="35%" r="75%">
          <stop offset="0" stopColor="#2E3238" />
          <stop offset="0.55" stopColor="#202328" />
          <stop offset="1" stopColor="#111315" />
        </radialGradient>
        <radialGradient id="vignette" cx="50%" cy="45%" r="72%">
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.7" />
        </radialGradient>
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.07 0" />
        </filter>
        <filter id="mottle" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="2" seed="4" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0" />
        </filter>
      </defs>

      <rect width={W} height={H} fill="url(#stoneLight)" />
      <rect width={W} height={H} filter="url(#mottle)" />
      <rect width={W} height={H} filter="url(#grain)" />

      <g stroke={GREY} strokeWidth="0.6" opacity="0.13">
        <line x1="-100" y1="40" x2="1700" y2="980" />
        <line x1="200" y1="1050" x2="1500" y2="-60" />
        <line x1="0" y1="610" x2="1600" y2="430" />
      </g>

      {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#F2EFEA" opacity={s.o} />)}

      {SYSTEMS.map((sys, si) => (
        <g key={si}>
          {sys.orbits.map((o, oi) => (
            <circle
              key={oi} cx={sys.x} cy={sys.y} r={o.r} fill="none"
              stroke={o.copper ? COPPER : GREY}
              strokeWidth={o.copper ? 0.9 : 0.6}
              strokeDasharray={o.copper ? '2 5' : undefined}
              opacity={o.copper ? 0.4 : 0.18}
            />
          ))}
          {sys.ticks && Array.from({ length: 48 }, (_, i) => {
            const a = (i * Math.PI) / 24;
            const r1 = sys.orbits[1].r;
            const r2 = r1 + (i % 4 === 0 ? 10 : 5);
            return <line key={i} x1={sys.x + Math.cos(a) * r1} y1={sys.y + Math.sin(a) * r1} x2={sys.x + Math.cos(a) * r2} y2={sys.y + Math.sin(a) * r2} stroke={GREY} strokeWidth="0.6" opacity="0.22" />;
          })}
          <circle cx={sys.x} cy={sys.y} r={sys.star * 3} fill={COPPER} opacity="0.12" />
          <circle cx={sys.x} cy={sys.y} r={sys.star} fill="#F2E3D2" opacity="0.85" />
        </g>
      ))}

      <rect width={W} height={H} fill="url(#vignette)" />
    </svg>
  );
}

/** Scale factor that reproduces SVG "xMidYMid slice" for the HTML planets layer. */
function useCoverScale() {
  const calc = () => Math.max(window.innerWidth / W, window.innerHeight / H);
  const [s, setS] = useState(calc);
  useEffect(() => {
    const on = () => setS(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return s;
}

/**
 * Moving planets as plain HTML elements rotated by CSS keyframes. Transform animations run on
 * the GPU compositor, so the main thread stays idle (SVG SMIL animation cost ~66% of a
 * 4x-throttled phone's main thread). Initial orbit position comes from a negative delay.
 */
function PlanetsLayer({ animate }: { animate: boolean }) {
  const scale = useCoverScale();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute left-1/2 top-1/2" style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})` }}>
        {SYSTEMS.flatMap((sys, si) =>
          sys.orbits.map((o, oi) => {
            const size = o.planet * 2;
            const spin = animate
              ? {
                  animation: `orbit ${o.period}s linear infinite`,
                  animationDirection: o.dir < 0 ? 'reverse' : 'normal',
                  animationDelay: `${-(o.phase / 360) * o.period}s`,
                }
              : { transform: `rotate(${o.phase * o.dir}deg)` };
            return (
              <div key={`${si}-${oi}`} className="absolute will-change-transform" style={{ left: sys.x, top: sys.y, width: 0, height: 0, ...spin }}>
                <div
                  className="absolute rounded-full"
                  style={{
                    left: o.r - size / 2, top: -size / 2, width: size, height: size,
                    background: o.color, opacity: 0.92,
                    boxShadow: `0 0 ${o.planet * 2}px ${o.color}55`,
                  }}
                />
                {o.moon && (
                  <div className="absolute" style={{ left: o.r, top: 0, width: 0, height: 0 }}>
                    <div
                      className="absolute rounded-full border"
                      style={{ left: -o.planet * 3.2, top: -o.planet * 3.2, width: o.planet * 6.4, height: o.planet * 6.4, borderColor: `${GREY}59`, borderWidth: 0.5 }}
                    />
                    <div className="absolute will-change-transform" style={{ width: 0, height: 0, ...(animate ? { animation: 'orbit 9s linear infinite' } : {}) }}>
                      <div className="absolute rounded-full" style={{ left: o.planet * 3.2 - 1.1, top: -1.1, width: 2.2, height: 2.2, background: PLANET_LIGHT }} />
                    </div>
                  </div>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

/**
 * Stone star-map background: charcoal stone + grain, vignette, faint stars, long crossing
 * hairlines, and small solar systems whose planets orbit slowly. Decorative only (aria-hidden).
 */
export function SpaceMap() {
  const reduce = useReducedMotion();
  return (
    <>
      <StaticLayer />
      <PlanetsLayer animate={!reduce} />
    </>
  );
}
