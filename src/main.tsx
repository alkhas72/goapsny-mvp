import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { App } from './App.tsx';
import { registerServiceWorker } from './registerSw.ts';
import { telegram } from './utils/telegram';

// П-15: сервис-воркер нужен публичному PWA-входу; в Telegram WebView не регистрируем.
if (!telegram.isTelegram()) {
  registerServiceWorker();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
