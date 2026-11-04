import { ChevronDown, Languages } from 'lucide-react';
import { useLanguage } from './language';
import { isLanguage, languages } from './translations';
import './language-selector.css';

export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  return <label className="language-selector">
    <Languages size={18} aria-hidden="true" />
    <select aria-label={t('언어 설정')} value={language} onChange={(event) => { if (isLanguage(event.target.value)) setLanguage(event.target.value); }}>
      {languages.map(({ code, label, locale }) => <option key={code} value={code} lang={locale}>{label}</option>)}
    </select>
    <ChevronDown size={13} className="language-chevron" aria-hidden="true" />
  </label>;
}
