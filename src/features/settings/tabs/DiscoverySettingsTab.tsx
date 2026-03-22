import { PanelSection } from '@/components/panel/PanelPageLayout';
import DiscoverySettings from '@/features/settings/DiscoverySettings';

export default function DiscoverySettingsTab() {
  return (
    <PanelSection title="Discovery" description="Generate shareable discovery codes and invite links.">
      <DiscoverySettings />
    </PanelSection>
  );
}
