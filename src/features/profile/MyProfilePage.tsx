import { useState } from 'react';
import { LogOut, MessageCircle, Pencil, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';

import { authApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import { APP_ROUTES } from '@/app/routes';
import { Button } from '@/components/ui/Button';
import { useProfile } from '@/hooks/useProfile';
import { useAppNavigation } from '@/navigation/appNavigation';
import { useAuthStore } from '@/store/authStore';

import { ProfilePageShell, type ProfileDetailItem } from './components/ProfilePageShell';
import { EditProfileDialog } from './edit/EditProfileDialog';

function formatLastSeen(value: string | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function MyProfilePage() {
  const { goTo } = useAppNavigation();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { profile, isLoading } = useProfile();
  const { userId, userEmail, refreshToken, logout } = useAuthStore();

  const displayName = profile?.display_name || profile?.username || userEmail || 'Your profile';
  const username = profile?.username ? `@${profile.username}` : null;
  const avatarUrl = profile?.avatar?.url || null;
  const bio = profile?.bio || null;
  const statusLabel = [profile?.status_emoji, profile?.status_text].filter(Boolean).join(' ') || null;
  const lastSeenLabel = formatLastSeen(profile?.last_seen_at);

  const details: ProfileDetailItem[] = [
    { label: 'Username', value: username ?? 'Not set' },
    { label: 'Display name', value: profile?.display_name || 'Not set' },
    ...(profile?.pronouns ? [{ label: 'Pronouns', value: profile.pronouns }] : []),
    ...(profile?.timezone ? [{ label: 'Timezone', value: profile.timezone }] : []),
    ...(lastSeenLabel ? [{ label: 'Last seen', value: lastSeenLabel }] : []),
  ];

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch (error) {
      toast.error(extractApiError(error, 'Failed to log out'));
    } finally {
      logout();
    }
  };

  return (
    <>
      <ProfilePageShell
      isOwner
      userId={userId ?? ''}
      displayName={displayName}
      username={username}
      avatarUrl={avatarUrl}
      bio={bio}
      statusLabel={statusLabel}
      details={details}
      isLoading={isLoading && !profile}
      headerActions={
        <>
          <Button type="button" size="sm" onClick={() => setIsEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit profile
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => goTo(APP_ROUTES.chat)}>
            <MessageCircle className="mr-2 h-4 w-4" />
            Chat
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => goTo(APP_ROUTES.settingsTab())}
          >
            <SettingsIcon className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void handleLogout()}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </>
      }
      />
      <EditProfileDialog open={isEditOpen} onOpenChange={setIsEditOpen} />
    </>
  );
}
