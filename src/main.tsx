import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { sessionManager } from '@/auth/session';
import { initNotificationSound } from '@/utils/notificationSound';

// Initialize auth session
sessionManager.initialize();
initNotificationSound();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
