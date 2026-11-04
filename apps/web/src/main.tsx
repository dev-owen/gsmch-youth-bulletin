import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { PublicPage, ArchivePage } from './public';
import { AdminPage } from './admin';
import './styles.css';
import './bulletin-layout.css';

function ToastViewport() {
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  useEffect(() => {
    let timer = 0;
    const show = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; kind: 'success' | 'error' }>).detail;
      setToast(detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setToast(null), 3600);
    };
    window.addEventListener('app-toast', show);
    return () => { window.removeEventListener('app-toast', show); window.clearTimeout(timer); };
  }, []);
  return <div className="toast-viewport" aria-live="polite" aria-atomic="true">{toast && <div className={`app-toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'}>{toast.message}</div>}</div>;
}

function App() {
  return <BrowserRouter><Routes>
    <Route path="/" element={<PublicPage />} />
    <Route path="/bulletins/:date" element={<PublicPage />} />
    <Route path="/archive" element={<ArchivePage />} />
    <Route path="/admin/*" element={<AdminPage />} />
    <Route path="*" element={<PublicPage invalidRoute />} />
  </Routes><ToastViewport /></BrowserRouter>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
