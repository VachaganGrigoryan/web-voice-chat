import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { APP_ROUTES, isSettingsTab, SettingsTab } from '@/app/routes';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/components/ThemeProvider';
import { unlockAudioExplicit } from '@/utils/notificationSound';
import { PanelPageLayout, PanelSection } from '@/components/panel/PanelPageLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/utils';
import {
  Bell,
  Camera,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  Palette,
  Save,
  Shield,
  Sun,
  Trash2,
  User,
  Volume2,
} from 'lucide-react';
import PasskeysSettings from './PasskeysSettings';
import DiscoverySettings from './DiscoverySettings';

const SETTINGS_NAV_ITEMS: Array<{
  id: SettingsTab;
  label: string;
  icon: typeof User;
  description: string;
}> = [
  { id: 'profile', label: 'Profile', icon: User, description: 'Identity and public details' },
  { id: 'appearance', label: 'Appearance', icon: Palette, description: 'Theme and visual preferences' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Chat sound behavior' },
  { id: 'privacy', label: 'Privacy', icon: Shield, description: 'Discovery and account access' },
  { id: 'passkeys', label: 'Passkeys', icon: KeyRound, description: 'Passwordless sign-in methods' },
  { id: 'discovery', label: 'Discovery', icon: User, description: 'Codes and invite links' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const routeTab = isSettingsTab(tab) ? tab : null;
  const activeTab = routeTab || 'profile';
  const activeNavItem = SETTINGS_NAV_ITEMS.find((item) => item.id === activeTab);
  const {
    profile,
    updateProfile,
    updateUsername,
    uploadAvatar,
    deleteAvatar,
    isUpdatingProfile,
    isUpdatingUsername,
    isUploadingAvatar,
    isDeletingAvatar,
  } = useProfile();
  const { mode, setMode, theme, setTheme } = useTheme();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [discoveryEnabled, setDiscoveryEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('soundEnabled') !== 'false');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    localStorage.setItem('soundEnabled', String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setUsername(profile.username || '');
    setDisplayName(profile.display_name || '');
    setBio(profile.bio || '');
    setIsPrivate(profile.is_private || false);
    setDiscoveryEnabled(profile.default_discovery_enabled ?? true);
  }, [profile]);

  if (!routeTab) {
    return <Navigate to={APP_ROUTES.settingsTab('profile')} replace />;
  }

  const showSaveAction = activeTab === 'profile' || activeTab === 'privacy';
  const isSaving = isUpdatingProfile || isUpdatingUsername;

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1);
      return;
    }

    if (activeTab !== 'profile') {
      navigate(APP_ROUTES.settingsTab('profile'));
      return;
    }

    navigate(APP_ROUTES.chat);
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    try {
      if (username !== (profile?.username || '')) {
        await updateUsername(username);
      }

      await updateProfile({
        display_name: displayName,
        bio,
        is_private: isPrivate,
        default_discovery_enabled: discoveryEnabled,
      });

      setSuccess('Settings updated successfully.');
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const errorData = err.response?.data?.error;
      const message =
        typeof errorData === 'string'
          ? errorData
          : errorData?.message || 'Failed to update settings';
      setError(message);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      await uploadAvatar(file);
      setSuccess('Avatar updated successfully.');
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const errorData = err.response?.data?.error;
      const message =
        typeof errorData === 'string'
          ? errorData
          : errorData?.message || 'Failed to upload avatar';
      setError(message);
    } finally {
      event.target.value = '';
    }
  };

  const handleDeleteAvatar = async () => {
    setError(null);
    setSuccess(null);

    try {
      await deleteAvatar();
      setSuccess('Avatar removed successfully.');
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const errorData = err.response?.data?.error;
      const message =
        typeof errorData === 'string'
          ? errorData
          : errorData?.message || 'Failed to remove avatar';
      setError(message);
    }
  };

  const renderToggle = (checked: boolean) => (
    <div
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-primary' : 'border bg-muted'
      )}
    >
      <div
        className={cn(
          'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-transform',
          checked ? 'translate-x-5' : 'translate-x-0'
        )}
      />
    </div>
  );

  const statusMessages = (
    <>
      {error ? (
        <PanelSection>
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        </PanelSection>
      ) : null}

      {success ? (
        <PanelSection>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400">
            {success}
          </div>
        </PanelSection>
      ) : null}
    </>
  );

  const sectionContent = (
    <>
      {activeTab === 'profile' ? (
        <>
          <PanelSection title="Identity" description="Update your public identity details and avatar.">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <div className="relative shrink-0">
                <Avatar className="h-28 w-28 border-4 border-background shadow-sm">
                  {profile?.avatar ? <AvatarImage src={profile.avatar.url} className="object-cover" /> : null}
                  <AvatarFallback className="bg-muted text-3xl">
                    {(profile?.display_name || profile?.username || profile?.email || '?')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-full bg-black/40 opacity-0 backdrop-blur-sm transition-opacity hover:opacity-100">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full text-white hover:bg-white/20 hover:text-white"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                  >
                    {isUploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </Button>
                  {profile?.avatar ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full text-red-300 hover:bg-white/20 hover:text-red-300"
                      onClick={handleDeleteAvatar}
                      disabled={isDeletingAvatar}
                    >
                      {isDeletingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  ) : null}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>

              <div className="space-y-1 pt-2 text-center sm:text-left">
                <div className="text-xl font-semibold">{profile?.display_name || profile?.username || 'User'}</div>
                <div className="text-sm text-muted-foreground">{profile?.email}</div>
                <div className="max-w-sm pt-2 text-sm text-muted-foreground">
                  Adjust your avatar, display name, username, and bio from the same profile panel.
                </div>
              </div>
            </div>
          </PanelSection>

          <PanelSection title="Profile Fields" description="These values are used across chat, discovery, and invitations.">
            <div className="max-w-xl space-y-5">
              <div className="space-y-2">
                <Label htmlFor="settings-username">Username</Label>
                <Input
                  id="settings-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Choose a unique username"
                  className="max-w-md"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-display-name">Display Name</Label>
                <Input
                  id="settings-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="How others see you"
                  className="max-w-md"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-bio">Bio</Label>
                <textarea
                  id="settings-bio"
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="A little about yourself"
                  className="flex min-h-[100px] w-full max-w-md resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          </PanelSection>
        </>
      ) : null}

      {activeTab === 'appearance' ? (
        <>
          <PanelSection title="Theme Mode" description="Switch between light, dark, and system appearance.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Button variant={mode === 'light' ? 'default' : 'outline'} className="h-12" onClick={() => setMode('light')}>
                <Sun className="mr-2 h-4 w-4" />
                Light
              </Button>
              <Button variant={mode === 'dark' ? 'default' : 'outline'} className="h-12" onClick={() => setMode('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </Button>
              <Button variant={mode === 'system' ? 'default' : 'outline'} className="h-12" onClick={() => setMode('system')}>
                <Monitor className="mr-2 h-4 w-4" />
                System
              </Button>
            </div>
          </PanelSection>

          <PanelSection title="Color Theme" description="Choose the accent palette used across the interface.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                variant={theme === 'default' ? 'default' : 'outline'}
                className="h-12 justify-start"
                onClick={() => setTheme('default')}
              >
                <div className="mr-3 h-4 w-4 rounded-full bg-zinc-900 dark:bg-zinc-100" />
                Default
              </Button>
              <Button
                variant={theme === 'slate' ? 'default' : 'outline'}
                className="h-12 justify-start"
                onClick={() => setTheme('slate')}
              >
                <div className="mr-3 h-4 w-4 rounded-full bg-slate-900 dark:bg-slate-100" />
                Slate
              </Button>
            </div>
          </PanelSection>
        </>
      ) : null}

      {activeTab === 'notifications' ? (
        <PanelSection title="Sound Notifications" description="Control audible notifications for new chat events.">
          <div className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full justify-start"
              onClick={async () => {
                const successState = await unlockAudioExplicit();
                if (successState) {
                  setSuccess('Sound enabled successfully.');
                  window.setTimeout(() => setSuccess(null), 3000);
                  return;
                }

                setError('Failed to enable sound. Please try again.');
                window.setTimeout(() => setError(null), 3000);
              }}
            >
              <Volume2 className="mr-3 h-4 w-4 text-muted-foreground" />
              Test and enable sound notifications
            </Button>

            <label className="flex cursor-pointer items-center justify-between rounded-2xl border bg-background/80 p-4 shadow-sm transition-colors hover:bg-accent/40">
              <div className="space-y-1 pr-4">
                <div className="text-sm font-medium">Sound Notifications</div>
                <div className="text-sm text-muted-foreground">Play a sound when a new message is received.</div>
              </div>
              {renderToggle(soundEnabled)}
              <input
                type="checkbox"
                className="hidden"
                checked={soundEnabled}
                onChange={(event) => setSoundEnabled(event.target.checked)}
              />
            </label>
          </div>
        </PanelSection>
      ) : null}

      {activeTab === 'privacy' ? (
        <PanelSection title="Privacy Controls" description="Control who can find you and who can start a chat.">
          <div className="space-y-4">
            <label className="flex cursor-pointer items-center justify-between rounded-2xl border bg-background/80 p-4 shadow-sm transition-colors hover:bg-accent/40">
              <div className="space-y-1 pr-4">
                <div className="text-sm font-medium">Private Account</div>
                <div className="text-sm text-muted-foreground">Only approved users can message you.</div>
              </div>
              {renderToggle(isPrivate)}
              <input
                type="checkbox"
                className="hidden"
                checked={isPrivate}
                onChange={(event) => setIsPrivate(event.target.checked)}
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-2xl border bg-background/80 p-4 shadow-sm transition-colors hover:bg-accent/40">
              <div className="space-y-1 pr-4">
                <div className="text-sm font-medium">Discoverable</div>
                <div className="text-sm text-muted-foreground">Allow others to find you by username.</div>
              </div>
              {renderToggle(discoveryEnabled)}
              <input
                type="checkbox"
                className="hidden"
                checked={discoveryEnabled}
                onChange={(event) => setDiscoveryEnabled(event.target.checked)}
              />
            </label>
          </div>
        </PanelSection>
      ) : null}

      {activeTab === 'passkeys' ? (
        <PanelSection title="Passkeys" description="Manage hardware-backed and password-manager-backed sign-in methods.">
          <PasskeysSettings />
        </PanelSection>
      ) : null}

      {activeTab === 'discovery' ? (
        <PanelSection title="Discovery" description="Generate shareable discovery codes and invite links.">
          <DiscoverySettings />
        </PanelSection>
      ) : null}
    </>
  );

  return (
    <PanelPageLayout
      title="Settings"
      description="Profile, appearance, notifications, privacy, passkeys, and discovery controls in one panel system."
      onBack={handleBack}
      onClose={() => navigate(APP_ROUTES.chat)}
      headerActions={
        showSaveAction ? (
          <Button type="button" size="sm" className="gap-2 rounded-full" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        ) : undefined
      }
      contentClassName="overflow-hidden p-0"
    >
      <div className="flex h-full min-h-0 flex-col md:flex-row">
        <aside className="hidden min-h-0 w-72 shrink-0 border-r border-border/70 bg-muted/10 md:flex md:flex-col">
          <div className="border-b border-border/60 px-5 py-4">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Sections
            </div>
          </div>
          <div className="scrollbar-hidden flex-1 overflow-y-auto px-3 py-3">
            <div className="space-y-1.5">
              {SETTINGS_NAV_ITEMS.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(APP_ROUTES.settingsTab(item.id))}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition-colors',
                      activeTab === item.id
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{item.label}</div>
                      <div
                        className={cn(
                          'mt-1 text-xs',
                          activeTab === item.id ? 'text-primary-foreground/80' : 'text-muted-foreground'
                        )}
                      >
                        {item.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border/60 px-4 py-3 md:hidden">
            <div className="scrollbar-hidden -mx-4 overflow-x-auto px-4">
              <div className="flex min-w-max gap-2">
                {SETTINGS_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(APP_ROUTES.settingsTab(item.id))}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors',
                        activeTab === item.id
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="scrollbar-hidden flex-1 overflow-y-auto">
            <div
              key={activeTab}
              className="space-y-4 p-4 animate-in fade-in slide-in-from-right-2 duration-200 sm:p-6 lg:p-8"
            >
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  {activeNavItem?.label || 'Settings'}
                </div>
                <div className="text-2xl font-semibold tracking-tight">
                  {activeNavItem?.label || 'Settings'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {activeNavItem?.description || 'Manage your account settings.'}
                </div>
              </div>

              {statusMessages}
              {sectionContent}
            </div>
          </div>
        </div>
      </div>
    </PanelPageLayout>
  );
}
