/** Faint orbit-diagram decoration placed inside cards (aria-hidden). Variant changes the layout. */
export function OrbitDecor({ variant = 0, className = '' }: { variant?: number; className?: string }) {
  const layouts = [
    { cx: 78, cy: 30, rings: [18, 34, 54, 80], dots: [[112, 52], [60, 62], [140, 24]] },
    { cx: 30, cy: 70, rings: [22, 44, 70, 100], dots: [[74, 54], [118, 88], [18, 26]] },
    { cx: 120, cy: 60, rings: [14, 30, 52, 76], dots: [[80, 40], [150, 96], [100, 112]] },
  ];
  const l = layouts[variant % layouts.length];
  return (
    <svg aria-hidden viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}>
      <g fill="none" stroke="#C9CED6" strokeWidth="0.35" opacity="0.22">
        {l.rings.map((r) => <circle key={r} cx={l.cx} cy={l.cy} r={r} />)}
        <line x1="0" y1={l.cy + 30} x2="160" y2={l.cy - 40} />
      </g>
      <circle cx={l.cx} cy={l.cy} r={l.rings[2]} fill="none" stroke="#C98B66" strokeWidth="0.45" strokeDasharray="1 2" opacity="0.5" />
      {l.dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === 0 ? 1.4 : 0.9} fill={i === 0 ? '#C98B66' : '#ECE8E1'} opacity="0.7" />)}
    </svg>
  );
}
