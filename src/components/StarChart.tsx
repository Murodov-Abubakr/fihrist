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

/**
 * Deep-space background: two star layers, slow twinkle, concentric orbital rings
 * and faint constellation links. Purely decorative, aria-hidden, fixed behind content.
 */
export function StarChart() {
  const { stars, links } = useMemo(() => {
    const r = mulberry32(2026);
    const stars = Array.from({ length: 220 }, (_, i) => ({
      x: r() * 1600, y: r() * 1000, s: r() < 0.08 ? 1.4 + r() : 0.3 + r() * 0.8, o: 0.15 + r() * 0.55, tw: i % 9 === 0, d: r() * 4,
    }));
    // constellation: link a handful of bright stars to their nearest bright neighbour
    const bright = stars.filter((s) => s.s > 1.3);
    const links: [number, number, number, number][] = [];
    bright.forEach((a) => {
      let best: (typeof bright)[number] | null = null;
      let bd = Infinity;
      bright.forEach((b) => {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (b !== a && d < bd && d < 260) { bd = d; best = b; }
      });
      if (best) links.push([a.x, a.y, (best as { x: number }).x, (best as { y: number }).y]);
    });
    return { stars, links };
  }, []);
  const cx = 800;
  const cy = 120;

  return (
    <svg aria-hidden className="pointer-events-none fixed inset-0 -z-10 h-full w-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="nebula" cx="50%" cy="8%" r="75%">
          <stop offset="0" stopColor="#1C2550" stopOpacity="0.75" />
          <stop offset="0.5" stopColor="#121838" stopOpacity="0.4" />
          <stop offset="1" stopColor="#0B1020" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="warm" cx="85%" cy="95%" r="45%">
          <stop offset="0" stopColor="#C9A55A" stopOpacity="0.06" />
          <stop offset="1" stopColor="#C9A55A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="1000" fill="url(#nebula)" />
      <rect width="1600" height="1000" fill="url(#warm)" />

      <g stroke="#A3AAC2" fill="none" opacity="0.07">
        {[180, 320, 480, 660, 860].map((r) => (
          <circle key={r} cx={cx} cy={cy} r={r} strokeWidth={r === 480 ? 1.1 : 0.7} />
        ))}
        <ellipse cx={cx} cy={cy} rx={700} ry={260} transform={`rotate(-12 ${cx} ${cy})`} strokeWidth="0.8" />
        <line x1={cx} y1={cy - 860} x2={cx} y2={cy + 860} strokeWidth="0.6" />
        <line x1={cx - 860} y1={cy} x2={cx + 860} y2={cy} strokeWidth="0.6" />
      </g>
      {/* orbiting markers on rings */}
      <g fill="#C9A55A" opacity="0.35">
        <circle cx={cx + 320 * Math.cos(0.6)} cy={cy + 320 * Math.sin(0.6)} r="2.5" />
        <circle cx={cx - 480 * Math.cos(0.35)} cy={cy + 480 * Math.sin(0.35)} r="2" />
        <circle cx={cx + 660 * Math.cos(1.1)} cy={cy + 660 * Math.sin(1.1)} r="1.6" />
      </g>

      <g stroke="#EADFC8" strokeWidth="0.5" opacity="0.08">
        {links.map(([x1, y1, x2, y2], i) => <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />)}
      </g>
      {stars.map((s, i) => (
        <circle
          key={i} cx={s.x} cy={s.y} r={s.s} fill={s.s > 1.3 ? '#F4ECDA' : '#C8CEE6'} opacity={s.o}
          className={s.tw ? 'twinkle' : undefined} style={s.tw ? { animationDelay: `${s.d}s` } : undefined}
        />
      ))}
    </svg>
  );
}
