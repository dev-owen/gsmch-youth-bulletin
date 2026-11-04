import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { isLanguage, languages, LANGUAGE_STORAGE_KEY, translate, type Language, type Translate } from './translations';

function readLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(stored) ? stored : 'ko';
  } catch { return 'ko'; }
}

const LanguageContext = createContext<{ language: Language; locale: string; setLanguage: (language: Language) => void; t: Translate }>({
  language: 'ko', locale: 'ko-KR', setLanguage: () => {}, t: (key, values) => translate('ko', key, values),
});
export const useLanguage = () => useContext(LanguageContext);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(readLanguage);
  const locale = languages.find(({ code }) => code === language)!.locale;
  useEffect(() => {
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* Language selection also works without device storage. */ }
    const previousLang = document.documentElement.lang;
    const previousTitle = document.title;
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
    document.title = `${translate(language, '선한목자 젊은이교회')} · ${translate(language, '모바일 주보')}`;
    return () => { document.documentElement.lang = previousLang; document.title = previousTitle; };
  }, [language]);
  useEffect(() => {
    const syncLanguage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY || event.key === null) setLanguage(readLanguage());
    };
    window.addEventListener('storage', syncLanguage);
    return () => window.removeEventListener('storage', syncLanguage);
  }, []);
  return <LanguageContext.Provider value={{ language, locale, setLanguage, t: (key, values) => translate(language, key, values) }}>{children}</LanguageContext.Provider>;
}

export function PublicLanguageLayout() {
  return <LanguageProvider><Outlet /></LanguageProvider>;
}
