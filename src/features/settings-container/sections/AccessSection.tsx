import { PanelSection } from '@/components/panel/PanelPageLayout';
import { SegmentedRule } from '../primitives';
import type { AccessData } from '../sectionData';

/**
 * Visibility and permission rules, each stated as the question a user is
 * actually asking and answered with the audience it grants. The policy value
 * behind a rule is an input to this control and never gates anything.
 */
export function AccessSection({ data }: { data: AccessData }) {
  return (
    <PanelSection
      title="Access & visibility"
      description="Who can find this, join it, and take part."
    >
      {data.rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          There is nothing to configure here for this conversation.
        </p>
      ) : (
        <div className="divide-y divide-border/60">
          {data.rules.map((rule) => (
            <SegmentedRule
              key={rule.id}
              question={rule.question}
              value={rule.value}
              options={rule.options}
              onChange={rule.onChange}
              disabled={data.isSaving}
            />
          ))}
        </div>
      )}
    </PanelSection>
  );
}
