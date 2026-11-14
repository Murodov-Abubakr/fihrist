import { motion, useReducedMotion } from 'framer-motion';

/** Astrolabe-ring loading indicator: two counter-rotating brass rings with tick marks. */
export function Astrolabe({ size = 48, label }: { size?: number; label?: string }) {
  const reduce = useReducedMotion();
  const spin = (dir: 1 | -1, dur: number) =>
    reduce ? {} : { animate: { rotate: 360 * dir }, transition: { repeat: Infinity, ease: 'linear' as const, duration: dur } };

  return (
    <div role="status" aria-live="polite" className="inline-flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <motion.g style={{ originX: '24px', originY: '24px' }} {...spin(1, 6)}>
          <circle cx="24" cy="24" r="21" fill="none" stroke="#C9A55A" strokeWidth="1" opacity="0.8" />
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i * Math.PI) / 12;
            const r2 = i % 6 === 0 ? 16.5 : 18.5;
            return <line key={i} x1={24 + Math.cos(a) * 21} y1={24 + Math.sin(a) * 21} x2={24 + Math.cos(a) * r2} y2={24 + Math.sin(a) * r2} stroke="#C9A55A" strokeWidth="0.8" />;
          })}
        </motion.g>
        <motion.g style={{ originX: '24px', originY: '24px' }} {...spin(-1, 3.5)}>
          <ellipse cx="24" cy="24" rx="12" ry="7" fill="none" stroke="#EADFC8" strokeWidth="0.8" opacity="0.6" />
          <line x1="10" y1="24" x2="38" y2="24" stroke="#C9A55A" strokeWidth="1.2" />
          <circle cx="36" cy="24" r="1.6" fill="#C9A55A" />
        </motion.g>
        <circle cx="24" cy="24" r="2" fill="#C9A55A" />
      </svg>
      {label && <span className="text-xs text-slate">{label}</span>}
    </div>
  );
}
