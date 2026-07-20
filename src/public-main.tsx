import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { PublicApp } from './PublicApp.tsx';
import { registerServiceWorker } from './registerSw.ts';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PublicApp />
  </StrictMode>,
);
