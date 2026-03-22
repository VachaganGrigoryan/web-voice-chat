import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import SettingsToggleField from '@/features/settings/components/SettingsToggleField';
import { Volume2 } from 'lucide-react';

interface NotificationsSettingsTabProps {
  soundEnabled: boolean;
  setSoundEnabled: (value: boolean) => void;
  onTestSound: () => Promise<void>;
}

export default function NotificationsSettingsTab({
  soundEnabled,
  setSoundEnabled,
  onTestSound,
}: NotificationsSettingsTabProps) {
  return (
    <PanelSection title="Sound Notifications" description="Control audible notifications for new chat events.">
      <div className="space-y-4">
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full justify-start"
          onClick={onTestSound}
        >
          <Volume2 className="mr-3 h-4 w-4 text-muted-foreground" />
          Test and enable sound notifications
        </Button>

        <SettingsToggleField
          title="Sound Notifications"
          description="Play a sound when a new message is received."
          checked={soundEnabled}
          onChange={setSoundEnabled}
        />
      </div>
    </PanelSection>
  );
}
