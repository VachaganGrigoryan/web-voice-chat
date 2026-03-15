import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from '@/app/App';
import '@/styles/index.css';
import { sessionManager } from '@/features/auth/api/session';
import { initNotificationSound } from '@/shared/utils/notificationSound';

// Initialize auth session
sessionManager.initialize();
initNotificationSound();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
