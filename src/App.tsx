import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import AuthPage from '@/features/auth/AuthPage';
import ChatLayout from '@/features/chat/ChatLayout';
import SettingsPage from '@/features/settings/SettingsPage';
import ProtectedRoute from '@/components/ProtectedRoute';
import PublicRoute from '@/components/PublicRoute';
import { ThemeProvider } from '@/components/ThemeProvider';

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

            <Route path="/" element={<Navigate to="/chat" replace />} />
          </Routes>
        </HashRouter>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
