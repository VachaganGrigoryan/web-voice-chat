import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import AuthPage from '@/features/auth/AuthPage';
import ChatLayout from '@/features/chat/ChatLayout';
import InvitePage from '@/features/invite/InvitePage';
import SettingsPage from '@/features/settings/SettingsPage';
import PingsPage from '@/features/pings/PingsPage';
import ProfilePage from '@/features/profile/ProfilePage';
import ProtectedRoute from '@/components/ProtectedRoute';
import PublicRoute from '@/components/PublicRoute';
import { ThemeProvider } from '@/components/ThemeProvider';
import { APP_ROUTES, getDefaultAuthedPath } from '@/app/routes';
import { useAuthStore } from '@/store/authStore';

const queryClient = new QueryClient();

function RootRedirect() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Navigate
      to={isAuthenticated ? getDefaultAuthedPath() : APP_ROUTES.login}
      replace
    />
  );
}

export default function App() {
  return (
    <ThemeProvider defaultMode="system" defaultTheme="default">
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <Routes>
            <Route element={<PublicRoute />}>
              <Route path={APP_ROUTES.login} element={<AuthPage />} />
              <Route path={APP_ROUTES.legacyAuth} element={<Navigate to={APP_ROUTES.login} replace />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path={APP_ROUTES.chat} element={<ChatLayout />} />
              <Route path="/chat/:peerUserId" element={<ChatLayout />} />
              <Route path="/chat/:peerUserId/thread/:rootMessageId" element={<ChatLayout />} />
              <Route path={APP_ROUTES.pings} element={<Navigate to={APP_ROUTES.pingsTab('incoming')} replace />} />
              <Route path="/pings/:tab" element={<PingsPage />} />
              <Route path={APP_ROUTES.settings} element={<Navigate to={APP_ROUTES.settingsTab('profile')} replace />} />
              <Route path="/settings/:tab" element={<SettingsPage />} />
              <Route path="/profile/:userId" element={<ProfilePage />} />
            </Route>

            <Route path={APP_ROUTES.invite(':token')} element={<InvitePage />} />
            <Route path={APP_ROUTES.root} element={<RootRedirect />} />
            <Route path="*" element={<Navigate to={APP_ROUTES.root} replace />} />
          </Routes>
        </HashRouter>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
