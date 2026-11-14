import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ru from './locales/ru.json';
import tg from './locales/tg.json';

export const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'ru', label: 'RU' },
  { code: 'tg', label: 'TJ' },
] as const;
export type LangCode = (typeof LANGS)[number]['code'];

/** Allowlist check: anything read from storage is untrusted input (OWASP A03/A08). */
export function safeLang(v: unknown): LangCode {
  return LANGS.some((l) => l.code === v) ? (v as LangCode) : 'en';
}

let saved: LangCode = 'en';
try {
  saved = safeLang(localStorage.getItem('fihrist.lang'));
} catch {
  /* storage unavailable (private mode) */
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ru: { translation: ru }, tg: { translation: tg } },
  lng: saved,
  supportedLngs: LANGS.map((l) => l.code),
  fallbackLng: 'en',
  // React escapes all interpolated values; i18next's own escaping would double-escape.
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  const code = safeLang(lng);
  try {
    localStorage.setItem('fihrist.lang', code);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = code;
});

document.documentElement.lang = safeLang(i18n.resolvedLanguage);

export default i18n;
