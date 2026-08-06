import { PanelSection } from '@/components/panel/PanelPageLayout';
import type { NotificationLevel } from '@/api/types';
import { SegmentedRule, SelectRow, SettingsRowGroup, ToggleRow } from '../primitives';
import type { NotificationsData } from '../sectionData';

const LEVEL_OPTIONS = [
  { value: 'all' as const, label: 'All', meaning: 'Notify me about every new message.' },
  {
    value: 'mentions' as const,
    label: 'Mentions',
    meaning: 'Notify me only when someone mentions me or replies to me.',
  },
  { value: 'none' as const, label: 'Nothing', meaning: 'Never notify me about this.' },
];

/** Milliseconds per mute window, keyed by the label shown on the button. */
const MUTE_WINDOWS: readonly { readonly label: string; readonly ms: number }[] = [
  { label: '8 hours', ms: 8 * 60 * 60 * 1000 },
  { label: '1 week', ms: 7 * 24 * 60 * 60 * 1000 },
];

/**
 * Personal settings, so this needs no management capability — it is the one
 * section a plain member of any container can always open.
 */
export function NotificationsSection({ data }: { data: NotificationsData }) {
  const mutedUntilDate = data.mutedUntil ? new Date(data.mutedUntil) : null;
  const isMuted = Boolean(mutedUntilDate && mutedUntilDate.getTime() > Date.now());

  return (
    <div className="space-y-4">
      <PanelSection title="Notifications" description="What reaches you from here.">
        <SegmentedRule
          question="What should notify you?"
          value={data.level}
          options={LEVEL_OPTIONS}
          onChange={(level) => data.onLevelChange(level as NotificationLevel)}
          disabled={data.isSaving}
        />

        <div className="mt-3 border-t border-border/60 pt-3">
          {isMuted && mutedUntilDate ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Muted until {mutedUntilDate.toLocaleString()}.
              </p>
              <button
                type="button"
                disabled={data.isSaving}
                onClick={() => data.onMutedUntilChange(null)}
                className="min-h-11 cursor-pointer rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                Unmute
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">Mute temporarily without changing the level above.</p>
              <div className="flex gap-2">
                {MUTE_WINDOWS.map((window) => (
                  <button
                    key={window.label}
                    type="button"
                    disabled={data.isSaving}
                    onClick={() =>
                      data.onMutedUntilChange(new Date(Date.now() + window.ms).toISOString())
                    }
                    className="min-h-11 cursor-pointer rounded-lg border border-border px-3 py-2 text-sm font-medium transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {window.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </PanelSection>

      <PanelSection title="Inbox" description="Where this sits in your list.">
        <SettingsRowGroup>
          <ToggleRow
            title="Pin to the top"
            description="Keep this above everything else in your inbox."
            checked={data.pinned}
            onChange={data.onPinnedChange}
            disabled={data.isSaving}
          />
          <ToggleRow
            title="Archive"
            description="Hide this from the main list until there is new activity."
            checked={data.archived}
            onChange={data.onArchivedChange}
            disabled={data.isSaving}
          />
          <SelectRow
            title="Folder"
            description="Group this with other conversations in your inbox."
            value={data.folder ?? ''}
            options={[
              { value: '', label: 'No folder' },
              ...data.folderOptions.map((name) => ({ value: name, label: name })),
            ]}
            onChange={(value) => data.onFolderChange(value === '' ? null : value)}
            disabled={data.isSaving}
          />
        </SettingsRowGroup>
      </PanelSection>
    </div>
  );
}
