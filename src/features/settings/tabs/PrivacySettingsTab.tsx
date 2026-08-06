import { useNavigate } from 'react-router-dom';
import { Ban, ChevronRight } from 'lucide-react';

import { APP_ROUTES } from '@/app/routes';
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
  const navigate = useNavigate();

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

        {/* The blocked list is a list of people, so it lives with People rather
            than inside a preferences panel. */}
        <button
          type="button"
          onClick={() => navigate(APP_ROUTES.peopleTab('blocked'))}
          className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-border/70 px-4 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Ban className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Blocked users</span>
            <span className="block text-xs text-muted-foreground">
              Review and unblock people in People → Blocked
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </div>
    </PanelSection>
  );
}
