import { motion, useReducedMotion } from 'framer-motion';

/** Astrolabe-ring loader, HUD style: outer tick ring, counter-rotating orbit with a glowing body. */
export function Astrolabe({ size = 48, label }: { size?: number; label?: string }) {
  const reduce = useReducedMotion();
  const spin = (dir: 1 | -1, dur: number) =>
    reduce ? {} : { animate: { rotate: 360 * dir }, transition: { repeat: Infinity, ease: 'linear' as const, duration: dur } };

  return (
    <div role="status" aria-live="polite" className="inline-flex flex-col items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="overflow-visible">
        <motion.g style={{ originX: '24px', originY: '24px' }} {...spin(1, 12)}>
          <circle cx="24" cy="24" r="21" fill="none" stroke="#C9A55A" strokeWidth="0.6" opacity="0.5" />
          {Array.from({ length: 36 }, (_, i) => {
            const a = (i * Math.PI) / 18;
            const r2 = i % 9 === 0 ? 18 : 19.6;
            return <line key={i} x1={24 + Math.cos(a) * 21} y1={24 + Math.sin(a) * 21} x2={24 + Math.cos(a) * r2} y2={24 + Math.sin(a) * r2} stroke="#C9A55A" strokeWidth="0.6" opacity="0.7" />;
          })}
        </motion.g>
        <motion.g style={{ originX: '24px', originY: '24px' }} {...spin(-1, 3)}>
          <circle cx="24" cy="24" r="13" fill="none" stroke="#A3AAC2" strokeWidth="0.6" strokeDasharray="2 3" opacity="0.6" />
          <circle cx="37" cy="24" r="2.2" fill="#C9A55A" style={{ filter: 'drop-shadow(0 0 3px #C9A55A)' }} />
        </motion.g>
        <circle cx="24" cy="24" r="3" fill="none" stroke="#C9A55A" strokeWidth="1" />
        <circle cx="24" cy="24" r="1" fill="#C9A55A" />
      </svg>
      {label && <span className="text-xs tracking-wide text-slate">{label}</span>}
    </div>
  );
}
