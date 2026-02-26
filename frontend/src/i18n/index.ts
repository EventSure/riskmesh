import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko';
import en from './locales/en';

i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: ko },
    en: { translation: en },
  },
  lng: localStorage.getItem('lang') || 'ko',
  fallbackLng: 'ko',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('lang', lng);
  document.documentElement.lang = lng;
});

export default i18n;
