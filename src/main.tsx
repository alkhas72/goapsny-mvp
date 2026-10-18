import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { isLabMode } from './lab/entry';

// SDK Telegram грузится здесь, а не тегом в <head>: публичному входу он не
// нужен, а синхронная загрузка с telegram.org задерживала первую отрисовку
// для всех и грозила белым экраном там, где домен недоступен.
// ensureTelegramSdk сам решает, нужен ли SDK, и не ждёт его дольше таймаута.
async function bootstrap() {
  // Select before importing any live shell, SDK, auth or service-worker module.
  const App = isLabMode(window.location.search)
    ? (await import('./lab/LabApp')).LabApp
    : await loadLiveApp();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();

async function loadLiveApp() {
  const [{ ensureTelegramSdk }, { telegram }, { registerServiceWorker }, { App }] = await Promise.all([
    import('./utils/telegramSdk'), import('./utils/telegram'), import('./registerSw'), import('./App'),
  ]);
  await ensureTelegramSdk();
  if (!telegram.isTelegram()) registerServiceWorker();
  return App;
}
