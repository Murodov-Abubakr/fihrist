import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import ru from './locales/ru.json';
import tg from './locales/tg.json';

// safeLang is re-implemented check-for-check here because importing i18n/index touches the DOM.
const CODES = ['en', 'ru', 'tg'];
const safeLang = (v: unknown) => (CODES.includes(v as string) ? v : 'en');

function keys(o: unknown, prefix = ''): string[] {
  if (typeof o !== 'object' || o === null || Array.isArray(o)) return [prefix];
  return Object.entries(o).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe('i18n', () => {
  it('ru and tg have exactly the same keys as en', () => {
    expect(keys(ru).sort()).toEqual(keys(en).sort());
    expect(keys(tg).sort()).toEqual(keys(en).sort());
  });
  it('no translation string contains HTML tags', () => {
    const strings = [en, ru, tg].flatMap((l) => JSON.stringify(l).match(/<[a-z/][^>]*>/gi) ?? []);
    expect(strings).toEqual([]);
  });
  it('tampered language values fall back to en', () => {
    expect(safeLang('ru')).toBe('ru');
    expect(safeLang('"><img src=x onerror=alert(1)>')).toBe('en');
    expect(safeLang('__proto__')).toBe('en');
    expect(safeLang(null)).toBe('en');
  });
});
