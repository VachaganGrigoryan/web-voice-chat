import { PanelSection } from '@/components/panel/PanelPageLayout';
import SettingsToggleField from '@/features/settings/components/SettingsToggleField';

interface PrivacySettingsTabProps {
  isPrivate: boolean;
  setIsPrivate: (value: boolean) => void;
  discoveryEnabled: boolean;
  setDiscoveryEnabled: (value: boolean) => void;
}

export default function PrivacySettingsTab({
  isPrivate,
  setIsPrivate,
  discoveryEnabled,
  setDiscoveryEnabled,
}: PrivacySettingsTabProps) {
  return (
    <PanelSection title="Privacy Controls" description="Control who can find you and who can start a chat.">
      <div className="space-y-4">
        <SettingsToggleField
          title="Private Account"
          description="Only approved users can message you."
          checked={isPrivate}
          onChange={setIsPrivate}
        />

        <SettingsToggleField
          title="Discoverable"
          description="Allow others to find you by username."
          checked={discoveryEnabled}
          onChange={setDiscoveryEnabled}
        />
      </div>
    </PanelSection>
  );
}
