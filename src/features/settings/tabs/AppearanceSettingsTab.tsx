import {
  FontSizePreference,
  LayoutDensity,
  ThemeColor,
  ThemeMode,
} from '@/components/ThemeProvider';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { DENSITY_OPTIONS, FONT_SIZE_OPTIONS } from '@/features/settings/config';
import { Monitor, Moon, Sun } from 'lucide-react';

interface AppearanceSettingsTabProps {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  theme: ThemeColor;
  setTheme: (theme: ThemeColor) => void;
  fontSize: FontSizePreference;
  setFontSize: (fontSize: FontSizePreference) => void;
  density: LayoutDensity;
  setDensity: (density: LayoutDensity) => void;
}

export default function AppearanceSettingsTab({
  mode,
  setMode,
  theme,
  setTheme,
  fontSize,
  setFontSize,
  density,
  setDensity,
}: AppearanceSettingsTabProps) {
  return (
    <>
      <PanelSection title="Theme Mode" description="Switch between light, dark, and system appearance.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Button variant={mode === 'light' ? 'default' : 'outline'} className="h-12" onClick={() => setMode('light')}>
            <Sun className="mr-2 h-4 w-4" />
            Light
          </Button>
          <Button variant={mode === 'dark' ? 'default' : 'outline'} className="h-12" onClick={() => setMode('dark')}>
            <Moon className="mr-2 h-4 w-4" />
            Dark
          </Button>
          <Button variant={mode === 'system' ? 'default' : 'outline'} className="h-12" onClick={() => setMode('system')}>
            <Monitor className="mr-2 h-4 w-4" />
            System
          </Button>
        </div>
      </PanelSection>

      <PanelSection title="Color Theme" description="Choose the accent palette used across the interface.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            variant={theme === 'default' ? 'default' : 'outline'}
            className="h-12 justify-start"
            onClick={() => setTheme('default')}
          >
            <div className="mr-3 h-4 w-4 rounded-full bg-zinc-900 dark:bg-zinc-100" />
            Default
          </Button>
          <Button
            variant={theme === 'slate' ? 'default' : 'outline'}
            className="h-12 justify-start"
            onClick={() => setTheme('slate')}
          >
            <div className="mr-3 h-4 w-4 rounded-full bg-slate-900 dark:bg-slate-100" />
            Slate
          </Button>
        </div>
      </PanelSection>

      <PanelSection
        title="Font Size"
        description="Stored in this browser and applied immediately across chat, panels, menus, and overlays."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {FONT_SIZE_OPTIONS.map((option) => {
            const isActive = fontSize === option.value;

            return (
              <Button
                key={option.value}
                type="button"
                variant={isActive ? 'default' : 'outline'}
                className="h-auto min-h-20 items-start justify-start gap-1 whitespace-normal px-4 py-3 text-left"
                onClick={() => setFontSize(option.value)}
              >
                <span className="text-sm font-semibold">{option.label}</span>
                <span className={cn('text-xs', isActive ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                  {option.description}
                </span>
              </Button>
            );
          })}
        </div>
      </PanelSection>

      <PanelSection
        title="Layout Density"
        description="Adjust spacing, paddings, gaps, bubble sizing, and panel rhythm for this browser."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {DENSITY_OPTIONS.map((option) => {
            const isActive = density === option.value;

            return (
              <Button
                key={option.value}
                type="button"
                variant={isActive ? 'default' : 'outline'}
                className="h-auto min-h-20 items-start justify-start gap-1 whitespace-normal px-4 py-3 text-left"
                onClick={() => setDensity(option.value)}
              >
                <span className="text-sm font-semibold">{option.label}</span>
                <span className={cn('text-xs', isActive ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                  {option.description}
                </span>
              </Button>
            );
          })}
        </div>
      </PanelSection>
    </>
  );
}
