import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { PublicPage, ArchivePage } from './public';
import { AdminPage } from './admin';
import './styles.css';

function App() {
  return <BrowserRouter><Routes>
    <Route path="/" element={<PublicPage />} />
    <Route path="/bulletins/:date" element={<PublicPage />} />
    <Route path="/archive" element={<ArchivePage />} />
    <Route path="/admin/*" element={<AdminPage />} />
    <Route path="*" element={<PublicPage invalidRoute />} />
  </Routes></BrowserRouter>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
