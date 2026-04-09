import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import './index.css';
import { sessionManager } from '@/auth/session';
import { initNotificationSound } from '@/utils/notificationSound';

sessionManager.initialize();
initNotificationSound();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
