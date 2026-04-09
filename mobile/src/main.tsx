import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App';
import './index.css';
import { sessionManager } from '@/auth/session';
import { initNotificationSound } from '@/utils/notificationSound';
import { androidNavigation } from '../plugins/androidNavigation';

sessionManager.initialize();
initNotificationSound();
void androidNavigation.init();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void androidNavigation.dispose();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
