/** Thin line icon set (24×24, stroke = currentColor). Original drawings for Fihrist. */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
});

export const Icons = {
  wheat: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M12 22V8" /><path d="M12 8c-2.5-.5-3.5-2.5-3.5-4.5 2.5.5 3.5 2.5 3.5 4.5Z" /><path d="M12 8c2.5-.5 3.5-2.5 3.5-4.5-2.5.5-3.5 2.5-3.5 4.5Z" /><path d="M12 13c-2.5-.5-3.5-2.5-3.5-4.5 2.5.5 3.5 2.5 3.5 4.5Z" /><path d="M12 13c2.5-.5 3.5-2.5 3.5-4.5-2.5.5-3.5 2.5-3.5 4.5Z" /><path d="M12 18c-2.5-.5-3.5-2.5-3.5-4.5 2.5.5 3.5 2.5 3.5 4.5Z" /><path d="M12 18c2.5-.5 3.5-2.5 3.5-4.5-2.5.5-3.5 2.5-3.5 4.5Z" /></svg>
  ),
  chickpea: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M5 15c0-5 4-9 9-9 2.5 0 4.5 1.5 4.5 4 0 5.5-5 9.5-10 9.5C6.5 19.5 5 17.5 5 15Z" /><circle cx="10" cy="14" r="1.6" /><circle cx="14" cy="11" r="1.6" /><path d="M18.5 10c1-1 1.5-2.5 1.5-4" /></svg>
  ),
  mung: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M12 21v-8" /><path d="M12 13c0-3.5-2.5-6-6-6 0 3.5 2.5 6 6 6Z" /><path d="M12 11c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6Z" /><path d="M7 21h10" /></svg>
  ),
  sorghum: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M12 22V11" /><ellipse cx="12" cy="6.5" rx="3" ry="4.5" /><path d="M10 5h4M9.5 7.5h5" /><path d="M12 16c-3 0-5-1.5-6-4M12 18c3 0 5-1.5 6-4" /></svg>
  ),
  cotton: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><circle cx="9" cy="10" r="3.2" /><circle cx="15" cy="10" r="3.2" /><circle cx="12" cy="6.5" r="3.2" /><path d="M7 14l5 2 5-2" /><path d="M12 16v6" /></svg>
  ),
  cover: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M3 18h18" /><path d="M5 18c0-3 1.5-5 4-6M10 18c0-3 1.5-5 4-6M15 18c0-3 1.5-5 4-6" /><path d="M7 4l1 1.5M12 3v2M17 4l-1 1.5" /></svg>
  ),
  water: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" /><path d="M9 15a3 3 0 0 0 3 3" /></svg>
  ),
  nitrogen: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M9 16V8l6 8V8" /></svg>
  ),
  erosion: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M2 19l6-9 4 5 3-3 7 7Z" /><path d="M15 19c1-1 2-1 3 0M18 19c.7-.6 1.4-.6 2 0" /></svg>
  ),
  organic: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M3 9h18M3 14h18M3 19h18" /><path d="M7 9c0-3 2-5 5-5 0 3-2 5-5 5Z" /></svg>
  ),
  forage: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M4 20c1-6 2-10 2-14M9 20c0-5 .5-8 2-12M14 20c0-4 1-7 3-10M19 20c0-3 0-5 1-7" /><path d="M2 20h20" /></svg>
  ),
  income: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5V8M12 16v1.5" /></svg>
  ),
  temp: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0Z" /><path d="M12 9v7" /></svg>
  ),
  rain: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M7 15a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5a3.3 3.3 0 0 1 0 6.5Z" /><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5" /></svg>
  ),
  satellite: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><rect x="9" y="9" width="6" height="6" rx="1" transform="rotate(45 12 12)" /><path d="M7.5 7.5 4 4M16.5 16.5 20 20" /><path d="M3 9l3-3M15 21l3-3" /><path d="M17 7a3 3 0 0 1 0 4" /></svg>
  ),
  spark: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M12 3v4M12 17v4M3 12h4M17 12h4" /><circle cx="12" cy="12" r="2.5" /></svg>
  ),
  trend: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></svg>
  ),
  gap: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><rect x="3.5" y="3.5" width="17" height="17" rx="2" strokeDasharray="3 3" /><path d="M10 10h.01M14 14h.01" strokeWidth="2.5" /></svg>
  ),
  alert: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M12 3 2.5 20h19Z" /><path d="M12 10v4M12 17h.01" /></svg>
  ),
  info: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></svg>
  ),
  search: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" /></svg>
  ),
  close: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M6 6l12 12M18 6 6 18" /></svg>
  ),
  chevron: ({ size, ...p }: P) => (
    <svg {...base(size)} {...p}><path d="M9 6l6 6-6 6" /></svg>
  ),
};
export type IconName = keyof typeof Icons;

export function Icon({ name, ...p }: P & { name: IconName }) {
  const C = Icons[name];
  return <C {...p} />;
}
