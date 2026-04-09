import { Bell, Volume2 } from 'lucide-react';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import SettingsToggleField from '@/features/settings/components/SettingsToggleField';
import {
  BrowserNotificationState,
  SoundCapability,
} from '@/utils/notificationSound';

interface NotificationsSettingsTabProps {
  soundEnabled: boolean;
  setSoundEnabled: (value: boolean) => void;
  soundCapability: SoundCapability;
  browserNotificationState: BrowserNotificationState;
  isEnablingSound: boolean;
  isRequestingBrowserNotifications: boolean;
  onTestSound: () => Promise<void>;
  onEnableBrowserNotifications: () => Promise<void>;
}

const getSoundStatusText = (
  soundEnabled: boolean,
  soundCapability: SoundCapability,
  browserNotificationState: BrowserNotificationState,
) => {
  if (!soundEnabled) {
    return 'Android notifications will stay silent until sound notifications are turned back on.';
  }

  if (browserNotificationState === 'granted') {
    return 'Android notifications are ready and will use the default notification sound.';
  }

  if (browserNotificationState === 'denied') {
    return 'Android notifications are blocked in system settings, so sound cannot play.';
  }

  if (soundCapability === 'unsupported') {
    return 'This build is not running inside the Android app shell.';
  }

  return 'Grant Android notification permission to enable native message alerts with sound.';
};

const getSystemNotificationStatusText = (state: BrowserNotificationState) => {
  switch (state) {
    case 'granted':
      return 'Android system notifications are enabled.';
    case 'denied':
      return 'Android system notifications are blocked in device settings.';
    case 'unsupported':
      return 'System notifications are unavailable in this runtime.';
    default:
      return 'Android notification permission has not been granted yet.';
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
}: NotificationsSettingsTabProps) {
  return (
    <div className="space-y-6">
      <PanelSection
        title="Sound Notifications"
        description="Use Android's default notification sound for incoming chat alerts."
      >
        <div className="space-y-4">
          <div className="rounded-2xl border bg-background/80 p-4 text-sm text-muted-foreground shadow-sm">
            {getSoundStatusText(soundEnabled, soundCapability, browserNotificationState)}
          </div>

          <Button
            type="button"
            variant="outline"
            className="h-12 w-full justify-start"
            onClick={() => void onTestSound()}
            disabled={!soundEnabled || isEnablingSound}
          >
            <Volume2 className="mr-3 h-4 w-4 text-muted-foreground" />
            {isEnablingSound ? 'Testing Android notification...' : 'Enable and test sound'}
          </Button>

          <SettingsToggleField
            title="Sound Notifications"
            description="Play the Android notification sound when a new message arrives outside the active chat view."
            checked={soundEnabled}
            onChange={setSoundEnabled}
          />
        </div>
      </PanelSection>

      <PanelSection
        title="System Notifications"
        description="Control Android notification permission separately from the sound preference."
      >
        <div className="space-y-4">
          <div className="rounded-2xl border bg-background/80 p-4 text-sm text-muted-foreground shadow-sm">
            {getSystemNotificationStatusText(browserNotificationState)}
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
              ? 'Requesting Android permission...'
              : 'Enable Android notifications'}
          </Button>
        </div>
      </PanelSection>
    </div>
  );
}
