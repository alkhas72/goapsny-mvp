import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import './skin-living.css';
import { App } from './App.tsx';
import { registerServiceWorker } from './registerSw.ts';
import { telegram } from './utils/telegram';
import { ensureTelegramSdk } from './utils/telegramSdk';
import { initSkin } from './utils/skin';

// SDK Telegram грузится здесь, а не тегом в <head>: публичному входу он не
// нужен, а синхронная загрузка с telegram.org задерживала первую отрисовку
// для всех и грозила белым экраном там, где домен недоступен.
// ensureTelegramSdk сам решает, нужен ли SDK, и не ждёт его дольше таймаута.
async function bootstrap() {
  // Оболочка «живой интерфейс» включается адресом ?skin=living; по умолчанию вид прежний.
  initSkin();
  await ensureTelegramSdk();

  // П-15: сервис-воркер нужен публичному PWA-входу; в Telegram WebView не регистрируем.
  if (!telegram.isTelegram()) {
    registerServiceWorker();
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
