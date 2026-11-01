/**
 * Language Configuration for Hostel Management System
 * Supports:
 * - English ('en') - Default
 * - Hindi ('hi') - हिन्दी
 * - Marathi ('mr') - मराठी
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', locale: 'en-IN' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', locale: 'hi-IN' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', locale: 'mr-IN' },
];

export const DEFAULT_LANGUAGE = 'en';

export const LANGUAGE_STORAGE_KEY = 'hms_language';

/**
 * Returns formatted date according to the active language
 */
export function formatLocalizedDate(date, language = 'en', options = {}) {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const localeMap = {
    en: 'en-IN',
    hi: 'hi-IN',
    mr: 'mr-IN',
  };

  const defaultOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };

  try {
    return new Intl.DateTimeFormat(localeMap[language] || 'en-IN', defaultOptions).format(d);
  } catch (err) {
    return d.toLocaleDateString();
  }
}

/**
 * Returns formatted time according to the active language
 */
export function formatLocalizedTime(date, language = 'en', options = {}) {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const localeMap = {
    en: 'en-IN',
    hi: 'hi-IN',
    mr: 'mr-IN',
  };

  const defaultOptions = {
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };

  try {
    return new Intl.DateTimeFormat(localeMap[language] || 'en-IN', defaultOptions).format(d);
  } catch (err) {
    return d.toLocaleTimeString();
  }
}

