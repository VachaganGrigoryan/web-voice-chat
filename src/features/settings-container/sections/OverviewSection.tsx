import { useEffect, useState } from 'react';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { SettingsRow, SettingsRowGroup } from '../primitives';
import type { OverviewData } from '../sectionData';

/**
 * Name and description where the viewer may edit them, and the facts about the
 * subject either way. A reader gets the facts without an empty form above them.
 */
export function OverviewSection({ data }: { data: OverviewData }) {
  return (
    <div className="space-y-4">
      {data.edit ? <OverviewEditor edit={data.edit} /> : null}

      {data.facts.length > 0 ? (
        <PanelSection title="Details" description="What this is and how it is set up.">
          <SettingsRowGroup>
            {data.facts.map((fact) => (
              <SettingsRow
                key={fact.label}
                title={fact.label}
                control={<span className="text-sm text-muted-foreground">{fact.value}</span>}
              />
            ))}
          </SettingsRowGroup>
        </PanelSection>
      ) : null}
    </div>
  );
}

function OverviewEditor({ edit }: { edit: NonNullable<OverviewData['edit']> }) {
  const [name, setName] = useState(edit.name);
  const [description, setDescription] = useState(edit.description ?? '');

  // Re-sync when the subject changes underneath an open panel.
  useEffect(() => {
    setName(edit.name);
    setDescription(edit.description ?? '');
  }, [edit.name, edit.description]);

  const trimmed = name.trim();
  const isDirty = trimmed !== edit.name || (description || null) !== edit.description;

  return (
    <PanelSection title="General" description="The name people see.">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="settings-name">Name</Label>
          <Input
            id="settings-name"
            value={name}
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        {edit.supportsDescription ? (
          <div className="space-y-1.5">
            <Label htmlFor="settings-description">Description</Label>
            <Input
              id="settings-description"
              value={description}
              maxLength={280}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={edit.isSaving || !trimmed || !isDirty}
            onClick={() => edit.onSave({ name: trimmed, description: description.trim() || null })}
          >
            Save changes
          </Button>
        </div>
      </div>
    </PanelSection>
  );
}
