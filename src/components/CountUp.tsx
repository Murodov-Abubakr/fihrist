import { useEffect, useRef, useState } from 'react';

/** Animated number counter (~600 ms ease-out); instant when the user prefers reduced motion. */
export function CountUp({ value, decimals = 0, locale = 'en-US' }: { value: number; decimals?: number; locale?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !Number.isFinite(value)) { setShown(value); from.current = value; return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 600);
      const e = 1 - (1 - t) ** 3;
      setShown(a + (value - a) * e);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  if (!Number.isFinite(shown)) return <>—</>;
  return <>{shown.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}
