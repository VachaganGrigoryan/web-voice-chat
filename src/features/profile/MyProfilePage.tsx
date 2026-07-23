import { Loader2, LogOut, Pencil, Settings as SettingsIcon } from 'lucide-react';
import { toast } from 'sonner';

import { authApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import { APP_ROUTES } from '@/app/routes';
import { PanelPageLayout, PanelSection } from '@/components/panel/PanelPageLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { useProfile } from '@/hooks/useProfile';
import { useAppNavigation } from '@/navigation/appNavigation';
import { useAuthStore } from '@/store/authStore';

function formatLastSeen(value: string | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

interface MetaChipProps {
  label: string;
  value: string;
}

function MetaChip({ label, value }: MetaChipProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export default function MyProfilePage() {
  const { goBack, goTo } = useAppNavigation();
  const { profile, isLoading } = useProfile();
  const { userEmail, refreshToken, logout } = useAuthStore();

  const displayName = profile?.display_name || profile?.username || userEmail || 'Your profile';
  const username = profile?.username ? `@${profile.username}` : null;
  const avatarUrl = profile?.avatar?.url || null;
  const bio = profile?.bio || null;
  const statusLabel = [profile?.status_emoji, profile?.status_text].filter(Boolean).join(' ');
  const lastSeenLabel = formatLastSeen(profile?.last_seen_at);

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
    <PanelPageLayout
      title="Your profile"
      description="How you appear to others, and quick access to your settings."
      onBack={() => goBack({ fallback: APP_ROUTES.chat })}
      onClose={() => goTo(APP_ROUTES.chat)}
      contentClassName="scrollbar-hidden space-y-4"
    >
      <PanelSection>
        {isLoading && !profile ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-10">
            <Avatar className="h-28 w-28 shrink-0 border-4 border-background shadow-sm sm:h-40 sm:w-40">
              {avatarUrl ? <AvatarImage src={avatarUrl} className="object-cover" /> : null}
              <AvatarFallback className="bg-muted text-4xl">
                {displayName[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 space-y-4 text-center sm:text-left">
              <div className="space-y-1">
                <h2 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                  {displayName}
                </h2>
                {username ? (
                  <p className="truncate text-sm text-muted-foreground">{username}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                <Button type="button" size="sm" onClick={() => goTo(APP_ROUTES.settingsTab('profile'))}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit profile
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => goTo(APP_ROUTES.settingsTab('profile'))}
                >
                  <SettingsIcon className="mr-2 h-4 w-4" />
                  Settings
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => void handleLogout()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </Button>
              </div>

              {statusLabel ? (
                <p className="text-sm text-foreground">{statusLabel}</p>
              ) : null}

              {bio ? (
                <p className="mx-auto max-w-2xl whitespace-pre-wrap text-sm leading-6 text-foreground sm:mx-0">
                  {bio}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No bio yet.</p>
              )}
            </div>
          </div>
        )}
      </PanelSection>

      {profile ? (
        <PanelSection title="Details" description="Extra identity details shown on your profile.">
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetaChip label="Username" value={username ?? 'Not set'} />
            <MetaChip label="Display name" value={profile.display_name || 'Not set'} />
            {profile.pronouns ? <MetaChip label="Pronouns" value={profile.pronouns} /> : null}
            {profile.timezone ? <MetaChip label="Timezone" value={profile.timezone} /> : null}
            {lastSeenLabel ? <MetaChip label="Last seen" value={lastSeenLabel} /> : null}
          </dl>
        </PanelSection>
      ) : null}
    </PanelPageLayout>
  );
}
