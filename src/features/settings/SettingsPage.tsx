import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { APP_ROUTES, isSettingsTab, SettingsTab } from '@/app/routes';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/components/ThemeProvider';
import { unlockAudioExplicit } from '@/utils/notificationSound';
import { PanelPageLayout, PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  Bell,
  Loader2,
  Save,
  User,
} from 'lucide-react';
import { SETTINGS_NAV_ITEMS } from './config';
import AppearanceSettingsTab from './tabs/AppearanceSettingsTab';
import DiscoverySettingsTab from './tabs/DiscoverySettingsTab';
import NotificationsSettingsTab from './tabs/NotificationsSettingsTab';
import PasskeysSettingsTab from './tabs/PasskeysSettingsTab';
import PrivacySettingsTab from './tabs/PrivacySettingsTab';
import ProfileSettingsTab from './tabs/ProfileSettingsTab';

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
  const { mode, setMode, theme, setTheme, fontSize, setFontSize, density, setDensity } = useTheme();
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

  const handleTestSound = async () => {
    const successState = await unlockAudioExplicit();
    if (successState) {
      setSuccess('Sound enabled successfully.');
      window.setTimeout(() => setSuccess(null), 3000);
      return;
    }

    setError('Failed to enable sound. Please try again.');
    window.setTimeout(() => setError(null), 3000);
  };

  const sectionContent = (
    <>
      {activeTab === 'profile' ? (
        <ProfileSettingsTab
          profile={profile}
          username={username}
          setUsername={setUsername}
          displayName={displayName}
          setDisplayName={setDisplayName}
          bio={bio}
          setBio={setBio}
          fileInputRef={fileInputRef}
          handleAvatarUpload={handleAvatarUpload}
          handleDeleteAvatar={handleDeleteAvatar}
          isUploadingAvatar={isUploadingAvatar}
          isDeletingAvatar={isDeletingAvatar}
        />
      ) : null}

      {activeTab === 'appearance' ? (
        <AppearanceSettingsTab
          mode={mode}
          setMode={setMode}
          theme={theme}
          setTheme={setTheme}
          fontSize={fontSize}
          setFontSize={setFontSize}
          density={density}
          setDensity={setDensity}
        />
      ) : null}

      {activeTab === 'notifications' ? (
        <NotificationsSettingsTab
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          onTestSound={handleTestSound}
        />
      ) : null}

      {activeTab === 'privacy' ? (
        <PrivacySettingsTab
          isPrivate={isPrivate}
          setIsPrivate={setIsPrivate}
          discoveryEnabled={discoveryEnabled}
          setDiscoveryEnabled={setDiscoveryEnabled}
        />
      ) : null}

      {activeTab === 'passkeys' ? <PasskeysSettingsTab /> : null}

      {activeTab === 'discovery' ? <DiscoverySettingsTab /> : null}
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
