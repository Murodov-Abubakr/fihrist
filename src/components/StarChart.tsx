import { useMemo } from 'react';

/** Deterministic PRNG so the star field is identical on every render (decorative only). */
function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Faint star-chart / astrolabe background. Purely decorative, aria-hidden. */
export function StarChart() {
  const stars = useMemo(() => {
    const r = mulberry32(1029);
    return Array.from({ length: 140 }, () => ({ x: r() * 1600, y: r() * 1000, s: r() * 1.3 + 0.3, o: r() * 0.6 + 0.2 }));
  }, []);
  const cx = 1180;
  const cy = 260;

  return (
    <svg
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="glow" cx="70%" cy="20%" r="70%">
          <stop offset="0" stopColor="#1A2350" stopOpacity="0.55" />
          <stop offset="1" stopColor="#0B1020" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="1000" fill="url(#glow)" />
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.s} fill="#EADFC8" opacity={s.o * 0.5} />
      ))}
      <g stroke="#C9A55A" fill="none" opacity="0.07">
        {[120, 220, 340, 480, 640].map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r} strokeWidth={r === 340 ? 1.2 : 0.7} />
        ))}
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i * Math.PI) / 12;
          return <line key={i} x1={cx + Math.cos(a) * 120} y1={cy + Math.sin(a) * 120} x2={cx + Math.cos(a) * 640} y2={cy + Math.sin(a) * 640} strokeWidth="0.5" />;
        })}
        {/* ecliptic-like tilted ellipse */}
        <ellipse cx={cx} cy={cy} rx={520} ry={190} transform={`rotate(-23.44 ${cx} ${cy})`} strokeWidth="0.9" strokeDasharray="4 6" />
        {Array.from({ length: 72 }, (_, i) => {
          const a = (i * Math.PI) / 36;
          const r1 = 340;
          const r2 = i % 6 === 0 ? 356 : 347;
          return <line key={`t${i}`} x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1} x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2} strokeWidth="0.8" />;
        })}
      </g>
    </svg>
  );
}
