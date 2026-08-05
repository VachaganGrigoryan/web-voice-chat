import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi, spacesApi } from '@/api/endpoints';
import { APP_ROUTES } from '@/app/routes';
import { CommandPalette } from '@/components/command/CommandPalette';
import { useProfile } from '@/hooks/useProfile';
import { useAuthStore } from '@/store/authStore';
import { AppRail } from './AppRail';
import { MobileTabBar } from './MobileTabBar';
import { MobileTopBar } from './MobileTopBar';
import { ShellErrorBoundary } from './ShellErrorBoundary';
import { useActiveSpace } from './useActiveSpace';
import { CreateIntent, useCreateIntent } from './useCreateIntent';
import { useNavBadges } from './useNavBadges';

const CREATE_INTENTS: readonly string[] = [
  'new-group',
  'new-channel',
  'new-space',
  'new-post',
];

const isCreateIntent = (value: string): value is CreateIntent =>
  CREATE_INTENTS.includes(value);

/**
 * The persistent application shell. Every authenticated route renders inside it,
 * so navigation never unmounts and no destination is a dead end.
 */
export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useProfile();
  const { userEmail, logout, refreshToken } = useAuthStore();
  const badges = useNavBadges();

  const activeSpaceId = useActiveSpace((state) => state.activeSpaceId);
  const setActiveSpaceId = useActiveSpace((state) => state.setActiveSpaceId);
  const requestIntent = useCreateIntent((state) => state.requestIntent);

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  const pathname = location.pathname;

  // The stored active space can outlive membership (left the space in another
  // session, space deleted). Validate it once against the user's own spaces
  // rather than carrying a puck selection that points nowhere.
  const spacesQuery = useQuery({ queryKey: ['spaces'], queryFn: () => spacesApi.list() });
  useEffect(() => {
    if (!activeSpaceId || !spacesQuery.data) return;
    const stillMember = spacesQuery.data.some((space) => space.id === activeSpaceId);
    if (!stillMember) setActiveSpaceId(null);
  }, [activeSpaceId, spacesQuery.data, setActiveSpaceId]);

  const handleCreate = useCallback(
    (actionId: string) => {
      if (actionId === 'new-space') {
        navigate(APP_ROUTES.spaces);
        return;
      }
      if (actionId === 'new-post') {
        navigate(APP_ROUTES.feed);
        requestIntent(actionId);
        return;
      }
      if (actionId === 'new-group' || actionId === 'new-channel') {
        navigate(APP_ROUTES.chat);
        requestIntent(actionId);
        return;
      }
      if (isCreateIntent(actionId)) {
        requestIntent(actionId);
      }
    },
    [navigate, requestIntent]
  );

  const handleLogout = useCallback(async () => {
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } finally {
      logout();
      navigate(APP_ROUTES.auth);
    }
  }, [refreshToken, logout, navigate]);

  const handleOpenSettings = useCallback(() => {
    navigate(APP_ROUTES.settingsTab());
  }, [navigate]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      <AppRail
        pathname={pathname}
        badges={badges}
        profile={profile}
        userEmail={userEmail}
        selectedSpaceId={activeSpaceId}
        onSpaceChange={setActiveSpaceId}
        onNavigate={navigate}
        onCreate={handleCreate}
        onOpenSearch={() => setIsPaletteOpen(true)}
        onOpenSettings={handleOpenSettings}
        onLogout={handleLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar
          profile={profile}
          userEmail={userEmail}
          selectedSpaceId={activeSpaceId}
          onSpaceChange={setActiveSpaceId}
          onNavigate={navigate}
          onOpenSearch={() => setIsPaletteOpen(true)}
          onOpenSettings={handleOpenSettings}
          onLogout={handleLogout}
        />

        <main className="flex min-h-0 flex-1 overflow-hidden">
          <ShellErrorBoundary resetKey={pathname}>
            <Outlet />
          </ShellErrorBoundary>
        </main>

        <MobileTabBar
          pathname={pathname}
          badges={badges}
          onNavigate={navigate}
        />
      </div>

      <CommandPalette open={isPaletteOpen} onOpenChange={setIsPaletteOpen} />
    </div>
  );
}
