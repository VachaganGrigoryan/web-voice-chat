import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { getApiErrorStatus, getRetryDelayMs, isRateLimitError } from '@/api/errors';
import AuthPage from '@/features/auth/AuthPage';
import ChatShell from '@/features/chat/ChatShell';
import ChatPage from '@/features/chat/ChatPage';
import InvitePage from '@/features/invite/InvitePage';
import LandingPage from '@/features/landing/LandingPage';
import SettingsPage from '@/features/settings/SettingsPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import ContactsPage from '@/features/profile/ContactsPage';
import DiscoverPage from '@/features/discovery/DiscoverPage';
import ProfilePage from '@/features/profile/ProfilePage';
import MyProfilePage from '@/features/profile/MyProfilePage';
import SpacesPage from '@/features/spaces/SpacesPage';
import SpaceHomePage from '@/features/spaces/SpaceHomePage';
import ChannelPage from '@/features/channels/ChannelPage';
import FeedPage from '@/features/feed/FeedPage';
import PostDetailPage from '@/features/feed/PostDetailPage';
import ManageChannelPage from '@/features/manage/ManageChannelPage';
import ManageConversationPage from '@/features/manage/ManageConversationPage';
import ManageHubPage from '@/features/manage/ManageHubPage';
import ManageSpacePage from '@/features/manage/ManageSpacePage';
import ProtectedRoute from '@/components/ProtectedRoute';
import PublicRoute from '@/components/PublicRoute';
import { ThemeProvider } from '@/components/ThemeProvider';
import { APP_ROUTES, ActivityTab, isActivityTab } from '@/app/routes';
import {
  LegacyChannelChatRedirect,
  LegacyChannelRedirect,
  LegacyConversationRedirect,
  LegacyUserFeedRedirect,
} from '@/app/routing/LegacyResourceRedirects';
import AppShell from '@/app/shell/AppShell';
import CallRoot from '@/features/calls/CallRoot';
import AppNavigationSync from '@/navigation/AppNavigationSync';
import CapabilityInvalidationRoot from '@/container/CapabilityInvalidationRoot';

/** A legacy path that now lives under a resource's `/manage/*` subtree. */
function LegacyManageRedirect({ to }: { to: (params: Readonly<Record<string, string | undefined>>) => string }) {
  const params = useParams();
  return <Navigate to={to(params)} replace />;
}

function LegacyActivityRedirect() {
  const { tab } = useParams<{ tab?: string }>();
  const target = isActivityTab(tab) ? APP_ROUTES.activityTab(tab as ActivityTab) : APP_ROUTES.activity;
  return <Navigate to={target} replace />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isRateLimitError(error)) {
          return false;
        }

        const status = getApiErrorStatus(error);
        if (status !== null && status >= 400 && status < 500 && status !== 408) {
          return false;
        }

        return failureCount < 3;
      },
      retryDelay: (attemptIndex, error) => getRetryDelayMs(error, attemptIndex),
    },
  },
});

export default function App() {
  return (
    <ThemeProvider defaultMode="system" defaultTheme="default">
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <AppNavigationSync />
          <CapabilityInvalidationRoot />
          <CallRoot />
          <Routes>
            <Route element={<PublicRoute />}>
              <Route path={APP_ROUTES.auth} element={<AuthPage />} />
              <Route path={APP_ROUTES.legacyLogin} element={<Navigate to={APP_ROUTES.auth} replace />} />
            </Route>

            <Route path={APP_ROUTES.root} element={<LandingPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                {/* Chats — one shell frame (inbox + outlet). */}
                <Route element={<ChatShell />}>
                  <Route path={APP_ROUTES.chat} element={<ChatPage />} />
                  <Route path="/dms/:conversationId" element={<ChatPage />} />
                  <Route path="/dms/:conversationId/thread/:rootMessageId" element={<ChatPage />} />
                  <Route path="/groups/:conversationId/chat" element={<ChatPage />} />
                  <Route path="/groups/:conversationId/chat/thread/:rootMessageId" element={<ChatPage />} />
                  <Route path="/spaces/:spaceId/groups/:conversationId/chat" element={<ChatPage />} />
                  <Route path="/spaces/:spaceId/groups/:conversationId/chat/thread/:rootMessageId" element={<ChatPage />} />
                  <Route path="/spaces/:spaceId/channels/:channelId/chat" element={<ChatPage />} />
                  <Route path="/spaces/:spaceId/channels/:channelId/chat/thread/:rootMessageId" element={<ChatPage />} />
                  {/* The feed lens is a route, not a stored preference, and it lives
                      inside the shell so switching lens keeps the inbox visible. */}
                  <Route path="/spaces/:spaceId/channels/:channelId/feed" element={<ChatPage />} />
                  {/* Channel routes precede the :conversationId param so "channels"
                      is never swallowed as a conversation id. */}
                  <Route path="/chat/channels/:channelId" element={<LegacyChannelChatRedirect />} />
                  <Route path="/chat/channels/:channelId/feed" element={<LegacyChannelChatRedirect />} />
                  <Route path="/chat/channels/:channelId/thread/:rootMessageId" element={<LegacyChannelChatRedirect />} />
                  <Route path="/chat/:conversationId" element={<LegacyConversationRedirect />} />
                  <Route path="/chat/:conversationId/thread/:rootMessageId" element={<LegacyConversationRedirect />} />
                  <Route path={APP_ROUTES.calls} element={<Navigate to={APP_ROUTES.activityTab('call-logs')} replace />} />
                </Route>
                {/* Management has its own chrome, not the ChatShell frame. */}
                <Route path="/chat/:conversationId/manage/:section" element={<ManageConversationPage />} />
                <Route path="/spaces/:spaceId/groups/:conversationId/manage/:section" element={<ManageConversationPage />} />

                {/* Feed and discovery surfaces */}
                <Route path={APP_ROUTES.feed} element={<FeedPage kind="home" />} />
                <Route path="/feed/:tab" element={<FeedPage kind="home" />} />
                <Route path={APP_ROUTES.feeds} element={<Navigate to={APP_ROUTES.feed} replace />} />
                <Route path="/feeds/users/:username" element={<LegacyUserFeedRedirect />} />
                <Route path="/feeds/channels/:channelId" element={<LegacyChannelRedirect />} />
                <Route path="/channels/:channelId/manage/:section" element={<ManageChannelPage />} />
                <Route path="/spaces/:spaceId/channels/:channelId/manage/:section" element={<ManageChannelPage />} />
                {/* Settings used to be a channel tab; it's a management section now. */}
                <Route
                  path="/channels/:channelId/settings"
                  element={<LegacyManageRedirect to={(p) => APP_ROUTES.channelManage(p.channelId!)} />}
                />
                <Route path="/spaces/:spaceId/channels/:channelId" element={<ChannelPage />} />
                <Route path="/spaces/:spaceId/channels/:channelId/:tab" element={<ChannelPage />} />
                <Route path="/channels/:channelId/posts/:postId" element={<PostDetailPage />} />
                <Route path="/channels/:channelId" element={<LegacyChannelRedirect />} />
                <Route path="/channels/:channelId/:tab" element={<LegacyChannelRedirect />} />
                <Route path={APP_ROUTES.discover} element={<DiscoverPage />} />
                <Route path="/discover/:tab" element={<DiscoverPage />} />
                <Route path={APP_ROUTES.people} element={<ContactsPage />} />
                <Route path="/people/:tab" element={<ContactsPage />} />
                <Route path={APP_ROUTES.contacts} element={<Navigate to={APP_ROUTES.people} replace />} />
                <Route path={APP_ROUTES.manage} element={<ManageHubPage />} />
                <Route path="/manage/:tab" element={<ManageHubPage />} />

                {/* Mode-independent */}
                <Route path={APP_ROUTES.activity} element={<NotificationsPage />} />
                <Route path="/activity/:tab" element={<NotificationsPage />} />
                <Route path={APP_ROUTES.notifications} element={<LegacyActivityRedirect />} />
                <Route path="/notifications/:tab" element={<LegacyActivityRedirect />} />
                <Route path="/pings" element={<Navigate to={APP_ROUTES.activity} replace />} />
                <Route path="/pings/:tab" element={<LegacyActivityRedirect />} />
                <Route path={APP_ROUTES.settings} element={<Navigate to={APP_ROUTES.settingsTab()} replace />} />
                <Route path="/settings/:tab" element={<SettingsPage />} />
                <Route path={APP_ROUTES.spaces} element={<SpacesPage />} />
                <Route path="/spaces/:spaceId/manage/:section" element={<ManageSpacePage />} />
                {/* Roles, invites, requests and settings were space tabs; they're management sections now. */}
                <Route
                  path="/spaces/:spaceId/roles"
                  element={<LegacyManageRedirect to={(p) => APP_ROUTES.spaceManage(p.spaceId!, 'roles')} />}
                />
                <Route
                  path="/spaces/:spaceId/invites"
                  element={<LegacyManageRedirect to={(p) => APP_ROUTES.spaceManage(p.spaceId!, 'invites')} />}
                />
                <Route
                  path="/spaces/:spaceId/requests"
                  element={<LegacyManageRedirect to={(p) => APP_ROUTES.spaceManage(p.spaceId!, 'requests')} />}
                />
                <Route
                  path="/spaces/:spaceId/settings"
                  element={<LegacyManageRedirect to={(p) => APP_ROUTES.spaceManage(p.spaceId!)} />}
                />
                <Route path="/spaces/:spaceId" element={<SpaceHomePage />} />
                <Route path="/spaces/:spaceId/:tab" element={<SpaceHomePage />} />
                <Route path={APP_ROUTES.me} element={<MyProfilePage />} />
                <Route path="/profile/:userId" element={<ProfilePage />} />
              </Route>
            </Route>

            <Route path={APP_ROUTES.invite(':token')} element={<InvitePage />} />
            <Route path="*" element={<Navigate to={APP_ROUTES.root} replace />} />
          </Routes>
        </HashRouter>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
