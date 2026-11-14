import { useReducedMotion } from 'framer-motion';

/**
 * Astrolabe-ring loader: grey tick ring + copper dashed orbit with a white planet.
 * Each ring is its own <svg> rotated by a CSS keyframe (compositor-only, no per-frame JS).
 */
export function Astrolabe({ size = 48, label }: { size?: number; label?: string }) {
  const reduce = useReducedMotion();
  const spin = (dur: number, reverse = false) =>
    reduce ? undefined : { animation: `orbit ${dur}s linear infinite`, animationDirection: reverse ? 'reverse' : 'normal' };
  const svg = 'absolute inset-0 overflow-visible will-change-transform';

  return (
    <div role="status" aria-live="polite" className="inline-flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }} aria-hidden>
        <svg viewBox="0 0 48 48" className={svg} style={spin(14)}>
          <circle cx="24" cy="24" r="21" fill="none" stroke="#C9CED6" strokeWidth="0.6" opacity="0.5" />
          {Array.from({ length: 36 }, (_, i) => {
            const a = (i * Math.PI) / 18;
            const r2 = i % 9 === 0 ? 17.5 : 19.5;
            return <line key={i} x1={24 + Math.cos(a) * 21} y1={24 + Math.sin(a) * 21} x2={24 + Math.cos(a) * r2} y2={24 + Math.sin(a) * r2} stroke="#C9CED6" strokeWidth="0.6" opacity="0.6" />;
          })}
        </svg>
        <svg viewBox="0 0 48 48" className={svg} style={spin(4, true)}>
          <circle cx="24" cy="24" r="12" fill="none" stroke="#C98B66" strokeWidth="0.8" strokeDasharray="1.5 3" />
          <circle cx="36" cy="24" r="2.4" fill="#F2EFEA" />
        </svg>
        <svg viewBox="0 0 48 48" className="absolute inset-0">
          <circle cx="24" cy="24" r="2.2" fill="#C98B66" />
        </svg>
      </div>
      {label && <span className="text-xs tracking-wide text-slate">{label}</span>}
    </div>
  );
}
