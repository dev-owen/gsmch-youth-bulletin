import { Languages } from 'lucide-react';
import { useLanguage } from './language';
import type { TranslationStatus } from './use-content-translation';
import './content-translation.css';

export function ContentTranslationNotice({ status, retry }: { status: TranslationStatus; retry: () => void }) {
  const { t } = useLanguage();
  if (status === 'idle') return null;
  return <div className="content-translation-notice" role="status" aria-live="polite">
    <Languages size={16} aria-hidden="true" />
    <p>{t(status === 'pending' ? '자동 번역 중입니다. 준비된 내용부터 표시합니다.' : status === 'complete' ? '자동 번역된 내용입니다.' : '번역을 불러오지 못한 내용은 한국어 원문으로 표시합니다.')}</p>
    {status === 'unavailable' && <button type="button" onClick={retry}>{t('번역 다시 시도')}</button>}
  </div>;
}
