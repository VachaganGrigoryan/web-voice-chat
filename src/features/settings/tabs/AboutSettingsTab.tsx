import { Globe, Palette, Smartphone } from 'lucide-react';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { BRAND } from '@/shared/branding/brand';
import { Logo } from '@/shared/branding/Logo';
import { PwaInstallCard } from '@/shared/branding/PwaInstallCard';

export default function AboutSettingsTab() {
  return (
    <div className="space-y-6">
      <PanelSection title="Brand" description="Central app identity, wordmark, and platform branding details.">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-border/70 bg-background/80 p-6 shadow-sm">
            <Logo variant="wordmark" size="lg" className="mb-5" />
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{BRAND.description}</p>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <Smartphone className="h-3.5 w-3.5" />
                Version
              </dt>
              <dd className="mt-2 text-sm font-medium text-foreground">v{__APP_VERSION__}</dd>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <Palette className="h-3.5 w-3.5" />
                Theme Color
              </dt>
              <dd className="mt-2 text-sm font-medium text-foreground">{BRAND.themeColor}</dd>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                <Globe className="h-3.5 w-3.5" />
                Display Name
              </dt>
              <dd className="mt-2 text-sm font-medium text-foreground">{BRAND.name}</dd>
            </div>
          </dl>
        </div>
      </PanelSection>

      <PanelSection title="Install" description="Install the branded web app for a cleaner standalone shell.">
        <PwaInstallCard
          showInstalledState
          showUnavailableState
          className="border-none bg-transparent p-0 shadow-none"
        />
      </PanelSection>
    </div>
  );
}
