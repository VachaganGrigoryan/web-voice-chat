import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import { sessionManager } from '@/auth/session';
import { initNotificationSound } from '@/utils/notificationSound';

// Initialize auth session
sessionManager.initialize();
initNotificationSound();

registerSW({
  immediate: true,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
