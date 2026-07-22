import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import SettingsToggleField from '@/features/settings/components/SettingsToggleField';
import {
  BrowserNotificationState,
  SoundCapability,
} from '@/utils/notificationSound';
import { Bell, Loader2, Save, Volume2 } from 'lucide-react';

interface NotificationsSettingsTabProps {
  soundEnabled: boolean;
  setSoundEnabled: (value: boolean) => void;
  soundCapability: SoundCapability;
  browserNotificationState: BrowserNotificationState;
  isEnablingSound: boolean;
  isRequestingBrowserNotifications: boolean;
  onTestSound: () => Promise<void>;
  onEnableBrowserNotifications: () => Promise<void>;
  dndFrom: string;
  setDndFrom: (value: string) => void;
  dndTo: string;
  setDndTo: (value: string) => void;
  notificationKeywords: string;
  setNotificationKeywords: (value: string) => void;
  onSaveNotificationPreferences: () => Promise<void>;
  isSavingNotificationPreferences: boolean;
}

const getSoundStatusText = (soundEnabled: boolean, soundCapability: SoundCapability) => {
  if (!soundEnabled) {
    return 'Sound notifications are off.';
  }

  switch (soundCapability) {
    case 'enabled':
      return 'Sound is enabled and ready to play message alerts and in-app call tones.';
    case 'blocked':
      return 'The browser blocked sound until you approve it with a click.';
    case 'unsupported':
      return 'This browser does not support Web Audio playback for alerts and call tones.';
    case 'error':
      return 'Sound could not be enabled. Try the button again.';
    default:
      return 'Sound is on, but browser approval is still needed before alerts and call tones can play.';
  }
};

const getBrowserNotificationStatusText = (state: BrowserNotificationState) => {
  switch (state) {
    case 'granted':
      return 'Browser notifications are enabled.';
    case 'denied':
      return 'Browser notifications are blocked in the browser settings.';
    case 'unsupported':
      return 'This browser does not support system notifications.';
    default:
      return 'Browser notifications have not been approved yet.';
  }
};

export default function NotificationsSettingsTab({
  soundEnabled,
  setSoundEnabled,
  soundCapability,
  browserNotificationState,
  isEnablingSound,
  isRequestingBrowserNotifications,
  onTestSound,
  onEnableBrowserNotifications,
  dndFrom,
  setDndFrom,
  dndTo,
  setDndTo,
  notificationKeywords,
  setNotificationKeywords,
  onSaveNotificationPreferences,
  isSavingNotificationPreferences,
}: NotificationsSettingsTabProps) {
  return (
    <div className="space-y-6">
      <PanelSection title="Sound Notifications" description="Control audible message alerts and in-app call tones.">
        <div className="space-y-4">
          <div className="rounded-2xl border bg-background/80 p-4 text-sm text-muted-foreground shadow-sm">
            {getSoundStatusText(soundEnabled, soundCapability)}
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-start"
            onClick={() => void onTestSound()}
            disabled={!soundEnabled || isEnablingSound}
          >
            <Volume2 className="mr-3 h-4 w-4 text-muted-foreground" />
            {isEnablingSound ? 'Enabling sound...' : 'Enable and test sound'}
          </Button>

          <SettingsToggleField
            title="Sound Notifications"
            description="Play sounds for new message alerts and call progress cues."
            checked={soundEnabled}
            onChange={setSoundEnabled}
          />
        </div>
      </PanelSection>

      <PanelSection
        title="Browser Notifications"
        description="Manage system notifications separately from in-app sound playback."
      >
        <div className="space-y-4">
          <div className="rounded-2xl border bg-background/80 p-4 text-sm text-muted-foreground shadow-sm">
            {getBrowserNotificationStatusText(browserNotificationState)}
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-start"
            onClick={() => void onEnableBrowserNotifications()}
            disabled={browserNotificationState === 'unsupported' || isRequestingBrowserNotifications}
          >
            <Bell className="mr-3 h-4 w-4 text-muted-foreground" />
            {isRequestingBrowserNotifications
              ? 'Requesting browser permission...'
              : 'Enable browser notifications'}
          </Button>
        </div>
      </PanelSection>

      <PanelSection
        title="Chat Delivery"
        description="Set quiet hours and keywords that override muted conversations."
      >
        <div className="max-w-xl space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="settings-dnd-from">Do Not Disturb From</Label>
              <Input
                id="settings-dnd-from"
                type="time"
                value={dndFrom}
                onChange={(event) => setDndFrom(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-dnd-to">Do Not Disturb To</Label>
              <Input
                id="settings-dnd-to"
                type="time"
                value={dndTo}
                onChange={(event) => setDndTo(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-notification-keywords">Keyword Alerts</Label>
            <Input
              id="settings-notification-keywords"
              value={notificationKeywords}
              onChange={(event) => setNotificationKeywords(event.target.value)}
              placeholder="deploy, urgent, release"
              autoComplete="off"
            />
          </div>

          <Button
            type="button"
            className="gap-2"
            onClick={() => void onSaveNotificationPreferences()}
            disabled={isSavingNotificationPreferences}
          >
            {isSavingNotificationPreferences ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save notification preferences
          </Button>
        </div>
      </PanelSection>
    </div>
  );
}
