import { useEffect, useState } from 'react';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import type { Channel, ChannelCommentPolicy, ChannelPostingPolicy, ChannelVisibility, UpdateChannelRequest } from '@/api/types';

type ChannelGeneralProps = {
  resourceType: 'channel';
  channel: Channel;
  onSave: (updates: UpdateChannelRequest) => void;
  isSaving: boolean;
};

type SpaceGeneralProps = {
  resourceType: 'space';
  name: string;
  visibility: 'private' | 'public';
  onSave: (updates: { name?: string; visibility?: string }) => void;
  isSaving: boolean;
};

type ConversationGeneralProps = {
  resourceType: 'conversation';
  title: string;
  onRename: (title: string) => void;
  isSaving: boolean;
};

type GeneralSectionProps = ChannelGeneralProps | SpaceGeneralProps | ConversationGeneralProps;

const VISIBILITY_OPTIONS: ChannelVisibility[] = ['public', 'members', 'private'];
const POSTING_OPTIONS: ChannelPostingPolicy[] = ['owner', 'moderators', 'members', 'everyone'];
const COMMENT_OPTIONS: ChannelCommentPolicy[] = ['disabled', 'followers', 'members', 'everyone'];

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
    </div>
  );
}

/** General resource details. Fields differ genuinely per resource type, so this switches on it rather than forcing one shared form. */
export function GeneralSection(props: GeneralSectionProps) {
  if (props.resourceType === 'channel') {
    return <ChannelGeneral {...props} />;
  }
  if (props.resourceType === 'space') {
    return <SpaceGeneral {...props} />;
  }
  return <ConversationGeneral {...props} />;
}

function ChannelGeneral({ channel, onSave, isSaving }: ChannelGeneralProps) {
  const [name, setName] = useState(channel.name);
  const [description, setDescription] = useState(channel.description ?? '');
  const [visibility, setVisibility] = useState<ChannelVisibility>(channel.visibility);
  const [postingPolicy, setPostingPolicy] = useState<ChannelPostingPolicy>(channel.posting_policy);
  const [commentPolicy, setCommentPolicy] = useState<ChannelCommentPolicy>(channel.comment_policy);

  useEffect(() => {
    setName(channel.name);
    setDescription(channel.description ?? '');
    setVisibility(channel.visibility);
    setPostingPolicy(channel.posting_policy);
    setCommentPolicy(channel.comment_policy);
  }, [channel]);

  return (
    <PanelSection title="General" description="Name, description and who may post or comment.">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} />
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={280} />
        </div>
        <SelectField label="Visibility" value={visibility} options={VISIBILITY_OPTIONS} onChange={(v) => setVisibility(v as ChannelVisibility)} />
        <SelectField label="Posting policy" value={postingPolicy} options={POSTING_OPTIONS} onChange={(v) => setPostingPolicy(v as ChannelPostingPolicy)} />
        <SelectField label="Comment policy" value={commentPolicy} options={COMMENT_OPTIONS} onChange={(v) => setCommentPolicy(v as ChannelCommentPolicy)} />
        <div className="flex justify-end">
          <Button
            type="button"
            disabled={isSaving}
            onClick={() =>
              onSave({
                name,
                description: description || null,
                visibility,
                posting_policy: postingPolicy,
                comment_policy: commentPolicy,
              })
            }
          >
            Save changes
          </Button>
        </div>
      </div>
    </PanelSection>
  );
}

function SpaceGeneral({ name: initialName, visibility: initialVisibility, onSave, isSaving }: SpaceGeneralProps) {
  const [name, setName] = useState(initialName);
  const [visibility, setVisibility] = useState(initialVisibility);

  useEffect(() => {
    setName(initialName);
    setVisibility(initialVisibility);
  }, [initialName, initialVisibility]);

  return (
    <PanelSection title="General" description="Name and visibility.">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} />
        </div>
        <SelectField label="Visibility" value={visibility} options={['private', 'public']} onChange={(v) => setVisibility(v as 'private' | 'public')} />
        <div className="flex justify-end">
          <Button type="button" disabled={isSaving} onClick={() => onSave({ name, visibility })}>
            Save changes
          </Button>
        </div>
      </div>
    </PanelSection>
  );
}

function ConversationGeneral({ title: initialTitle, onRename, isSaving }: ConversationGeneralProps) {
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  return (
    <PanelSection title="General" description="The group's name.">
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Group name</Label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} />
        </div>
        <div className="flex justify-end">
          <Button type="button" disabled={isSaving || !title.trim()} onClick={() => onRename(title.trim())}>
            Save changes
          </Button>
        </div>
      </div>
    </PanelSection>
  );
}
