import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatDate } from './lib';
import './bulletin-qr.css';
import { useLanguage } from './language';

export function BulletinQr({ serviceDate }: { serviceDate: string }) {
  const { t, locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'manual'>('idle');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  // Always share this edition, including when it is opened from the home page.
  const url = new URL(`/bulletins/${serviceDate}`, window.location.origin).href;

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      triggerRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch {
      setCopyState('manual');
    }
  }

  return <>
    <button ref={triggerRef} type="button" className="bulletin-qr-button" aria-label={t('이 주보 QR 코드 보기')} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} onClick={() => { setCopyState('idle'); setOpen(true); }}>
      <QRCodeSVG value={url} size={36} level="M" marginSize={4} aria-hidden="true" />
      <span>{t('QR 코드 보기')}</span>
    </button>
    <dialog ref={dialogRef} id={id} className="bulletin-qr-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onClose={() => setOpen(false)} onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className="bulletin-qr-sheet">
        <div className="bulletin-qr-heading">
          <div><span className="bulletin-qr-kicker">SHARE THIS BULLETIN</span><h2 id={`${id}-title`}>{t('이 주보 QR 코드')}</h2></div>
          <button type="button" className="bulletin-qr-close" aria-label={t('QR 코드 닫기')} onClick={() => setOpen(false)}><X size={22} aria-hidden="true" /></button>
        </div>
        <p className="bulletin-qr-date">{formatDate(serviceDate, locale)}</p>
        <a className="bulletin-qr-image" href={url} aria-label={t('{date} 주보 열기', { date: formatDate(serviceDate, locale) })}>
          <QRCodeSVG value={url} size={280} level="M" marginSize={4} role="img" title={t('{date} 주보 QR 코드', { date: formatDate(serviceDate, locale) })} />
        </a>
        <p id={`${id}-description`} className="bulletin-qr-description">{t('카메라로 QR 코드를 스캔하면')}<br />{t('이 날짜의 주보로 바로 연결됩니다.')}</p>
        <a className="bulletin-qr-link" href={url}><span>{url}</span><ArrowUpRight size={16} aria-hidden="true" /></a>
        <button type="button" className="bulletin-qr-copy" onClick={copyLink}>{copyState === 'copied' ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}{t(copyState === 'copied' ? '링크 복사 완료' : '주보 링크 복사')}</button>
        <p className="bulletin-qr-notice" role="status">{copyState === 'copied' ? t('주보 링크를 복사했습니다.') : copyState === 'manual' ? t('위 링크를 길게 누르거나 마우스 오른쪽 버튼을 눌러 복사해 주세요.') : ''}</p>
      </div>
    </dialog>
  </>;
}
