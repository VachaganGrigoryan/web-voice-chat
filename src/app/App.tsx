import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import AuthPage from '@/features/auth/pages/AuthPage';
import ChatLayout from '@/features/chat/components/layout/ChatLayout';
import SettingsPage from '@/features/settings/pages/SettingsPage';
import InvitePage from '@/features/chat/pages/InvitePage';
import ProtectedRoute from '@/app/router/ProtectedRoute';
import PublicRoute from '@/app/router/PublicRoute';
import { ThemeProvider } from '@/app/providers/ThemeProvider';

const queryClient = new QueryClient();

export default function App() {
  return (
    <ThemeProvider defaultMode="system" defaultTheme="default">
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <Routes>
            <Route element={<PublicRoute />}>
              <Route path="/auth" element={<AuthPage />} />
            </Route>
            
            <Route element={<ProtectedRoute />}>
              <Route path="/chat" element={<ChatLayout />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            <Route path="/invite/:token" element={<InvitePage />} />
            <Route path="/" element={<Navigate to="/chat" replace />} />
          </Routes>
        </HashRouter>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
