import { PanelSection } from '@/components/panel/PanelPageLayout';

const FIELD_LABEL: Record<string, string> = {
  visibility: 'Visibility',
  join_policy: 'Join policy',
  posting_policy: 'Posting policy',
  comment_policy: 'Comment policy',
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value.replace(/_/g, ' ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
};

interface AccessPolicySectionProps {
  policy: Readonly<Record<string, unknown>>;
}

/**
 * Renders the raw policy echo the capabilities response already carries, so
 * this section needs no second fetch. Display only — nothing here gates an
 * action; the server remains the only authority on what a viewer may do.
 */
export function AccessPolicySection({ policy }: AccessPolicySectionProps) {
  const entries = Object.entries(policy);

  return (
    <PanelSection title="Access policy" description="Who can see and post here.">
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No policy fields to show.</p>
      ) : (
        <dl className="divide-y divide-border rounded-2xl border border-border/70">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-4 px-4 py-3">
              <dt className="text-sm font-medium text-foreground">{FIELD_LABEL[key] ?? key.replace(/_/g, ' ')}</dt>
              <dd className="truncate text-sm capitalize text-muted-foreground">{formatValue(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </PanelSection>
  );
}
