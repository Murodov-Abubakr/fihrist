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

let saved = 'en';
try {
  saved = localStorage.getItem('fihrist.lang') ?? 'en';
} catch {
  /* storage unavailable (private mode) */
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ru: { translation: ru }, tg: { translation: tg } },
  lng: saved,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  try {
    localStorage.setItem('fihrist.lang', lng);
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lng;
});

document.documentElement.lang = i18n.resolvedLanguage ?? 'en';

export default i18n;
