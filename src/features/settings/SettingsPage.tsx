import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { APP_ROUTES, LEGACY_SETTINGS_REDIRECTS, isSettingsTab } from '@/app/routes';
import { extractApiError } from '@/api/errors';
import { useProfile } from '@/hooks/useProfile';
import { useTheme } from '@/components/ThemeProvider';
import { useNotificationSoundStore } from '@/utils/notificationSound';
import { PanelPageLayout, PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Loader2, Save } from 'lucide-react';
import { SETTINGS_NAV_ITEMS } from './config';
import AppearanceSettingsTab from './tabs/AppearanceSettingsTab';
import NotificationsSettingsTab from './tabs/NotificationsSettingsTab';
import PasskeysSettingsTab from './tabs/PasskeysSettingsTab';
import PrivacySettingsTab from './tabs/PrivacySettingsTab';
import AboutSettingsTab from './tabs/AboutSettingsTab';
import { useAppNavigation } from '@/navigation/appNavigation';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { goBack, goTo } = useAppNavigation();
  const { tab } = useParams<{ tab?: string }>();
  const routeTab = isSettingsTab(tab) ? tab : null;
  const activeTab = routeTab || 'appearance';
  const activeNavItem = SETTINGS_NAV_ITEMS.find((item) => item.id === activeTab);
  const {
    profile,
    updateProfile,
    isUpdatingProfile,
    updateNotificationPreferences,
    isUpdatingNotificationPreferences,
  } = useProfile();
  const { mode, setMode, theme, setTheme, fontSize, setFontSize, density, setDensity } = useTheme();
  const soundEnabled = useNotificationSoundStore((state) => state.soundEnabled);
  const soundCapability = useNotificationSoundStore((state) => state.soundCapability);
  const browserNotificationState = useNotificationSoundStore((state) => state.browserNotificationState);
  const isEnablingSound = useNotificationSoundStore((state) => state.isEnablingSound);
  const isRequestingBrowserNotifications = useNotificationSoundStore(
    (state) => state.isRequestingBrowserNotifications
  );
  const setSoundEnabled = useNotificationSoundStore((state) => state.setSoundEnabled);
  const enableSoundFromUserGesture = useNotificationSoundStore((state) => state.enableSoundFromUserGesture);
  const requestBrowserNotifications = useNotificationSoundStore((state) => state.requestBrowserNotifications);
  const syncBrowserNotificationState = useNotificationSoundStore((state) => state.syncBrowserNotificationState);
  const [timezone, setTimezone] = useState('');
  const [dndFrom, setDndFrom] = useState('');
  const [dndTo, setDndTo] = useState('');
  const [notificationKeywords, setNotificationKeywords] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [discoveryEnabled, setDiscoveryEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setTimezone(profile.timezone || '');
    setDndFrom(profile.dnd_from || '');
    setDndTo(profile.dnd_to || '');
    setNotificationKeywords((profile.notification_keywords || []).join(', '));
    setIsPrivate(profile.is_private || false);
    setDiscoveryEnabled(profile.default_discovery_enabled ?? true);
  }, [profile]);

  useEffect(() => {
    syncBrowserNotificationState();
  }, [syncBrowserNotificationState]);

  if (!routeTab) {
    // Profile editing, invite codes, passkeys and About all moved; send old links
    // and bookmarks to wherever their content actually lives now.
    const moved = tab ? LEGACY_SETTINGS_REDIRECTS[tab] : undefined;
    return <Navigate to={moved ?? APP_ROUTES.settingsTab()} replace />;
  }

  const showSaveAction = activeTab === 'privacy';
  const isSaving = isUpdatingProfile;

  const handleBack = () => {
    goBack({ fallback: APP_ROUTES.chat });
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);

    try {
      await updateProfile({
        is_private: isPrivate,
        default_discovery_enabled: discoveryEnabled,
      });

      setSuccess('Privacy settings updated successfully.');
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(extractApiError(err, 'Failed to update settings'));
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
          <div className="rounded-2xl border border-presence-online/25 bg-presence-online/10 px-4 py-3 text-sm text-presence-online">
            {success}
          </div>
        </PanelSection>
      ) : null}
    </>
  );

  const handleTestSound = async () => {
    setError(null);
    setSuccess(null);

    const successState = await enableSoundFromUserGesture();
    if (successState) {
      setSuccess('Sound enabled successfully.');
      window.setTimeout(() => setSuccess(null), 3000);
      return;
    }

    setError('Failed to enable sound. Please try again.');
    window.setTimeout(() => setError(null), 3000);
  };

  const handleEnableBrowserNotifications = async () => {
    setError(null);
    setSuccess(null);

    const permission = await requestBrowserNotifications();
    if (permission === 'granted') {
      setSuccess('System notifications enabled successfully.');
      window.setTimeout(() => setSuccess(null), 3000);
      return;
    }

    if (permission === 'unsupported') {
      setError('System notifications are not supported in this runtime.');
      window.setTimeout(() => setError(null), 3000);
      return;
    }

    setError('System notifications were not enabled.');
    window.setTimeout(() => setError(null), 3000);
  };

  const handleSaveNotificationPreferences = async () => {
    setError(null);
    setSuccess(null);

    try {
      await updateNotificationPreferences({
        timezone,
        dnd_from: dndFrom || null,
        dnd_to: dndTo || null,
        notification_keywords: notificationKeywords
          .split(',')
          .map((keyword) => keyword.trim())
          .filter(Boolean),
      });
      setSuccess('Notification preferences updated successfully.');
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const errorData = err.response?.data?.error;
      setError(errorData?.message || 'Failed to update notification preferences');
    }
  };

  const sectionContent = (
    <>
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
          soundCapability={soundCapability}
          browserNotificationState={browserNotificationState}
          isEnablingSound={isEnablingSound}
          isRequestingBrowserNotifications={isRequestingBrowserNotifications}
          onTestSound={handleTestSound}
          onEnableBrowserNotifications={handleEnableBrowserNotifications}
          dndFrom={dndFrom}
          setDndFrom={setDndFrom}
          dndTo={dndTo}
          setDndTo={setDndTo}
          notificationKeywords={notificationKeywords}
          setNotificationKeywords={setNotificationKeywords}
          onSaveNotificationPreferences={handleSaveNotificationPreferences}
          isSavingNotificationPreferences={isUpdatingNotificationPreferences}
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

      {/* Account bundles sign-in methods with app/build info: both are "this
          account on this device" rather than preferences. */}
      {activeTab === 'account' ? (
        <>
          <PasskeysSettingsTab />
          <AboutSettingsTab />
        </>
      ) : null}
    </>
  );

  return (
    <PanelPageLayout
      title="Settings"
      description="Appearance, notifications, privacy and account preferences."
      onBack={handleBack}
      onClose={() => goTo(APP_ROUTES.chat)}
      headerActions={
        showSaveAction ? (
          <Button
            type="button"
            size="sm"
            className="cursor-pointer gap-2 rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
            onClick={handleSave}
            disabled={isSaving}
          >
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
                        ? 'bg-brand text-brand-foreground shadow-e1'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{item.label}</div>
                      <div
                        className={cn(
                          'mt-1 text-xs',
                          activeTab === item.id ? 'text-brand-foreground/80' : 'text-muted-foreground'
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
                          ? 'bg-brand text-brand-foreground shadow-e1'
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
