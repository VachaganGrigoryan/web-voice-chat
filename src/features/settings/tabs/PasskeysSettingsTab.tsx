import { PanelSection } from '@/components/panel/PanelPageLayout';
import PasskeysSettings from '@/features/settings/PasskeysSettings';

export default function PasskeysSettingsTab() {
  return (
    <PanelSection title="Passkeys" description="Manage hardware-backed and password-manager-backed sign-in methods.">
      <PasskeysSettings />
    </PanelSection>
  );
}
