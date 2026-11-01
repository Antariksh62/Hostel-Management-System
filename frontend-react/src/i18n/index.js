import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from '../locales/en/translation.json';
import hi from '../locales/hi/translation.json';
import mr from '../locales/mr/translation.json';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY } from './languageConfig';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  mr: { translation: mr },
};

// Check if user previously saved a language in localStorage, otherwise strictly default to English ('en')
const savedLanguage = typeof window !== 'undefined' ? localStorage.getItem(LANGUAGE_STORAGE_KEY) : null;
const activeLang = savedLanguage && ['en', 'hi', 'mr'].includes(savedLanguage) ? savedLanguage : DEFAULT_LANGUAGE;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: activeLang,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: ['en', 'hi', 'mr'],
    detection: {
      order: ['localStorage'], // Strictly localStorage only — no navigator/browser auto-detect
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
