import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/utils';
import { extractApiError } from '@/api/errors';
import { useConversationActions } from '../hooks/useConversationActions';

type Visibility = 'private' | 'public';
type PostingPolicy = 'everyone' | 'admins';

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])$/;

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

function ChoicePills<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center rounded-full bg-muted p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
            value === option.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function CreateChannelDialog({ open, onOpenChange, onCreated }: CreateChannelDialogProps) {
  const { createChannel } = useConversationActions();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');
  const [postingPolicy, setPostingPolicy] = useState<PostingPolicy>('admins');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setDescription('');
    setVisibility('private');
    setPostingPolicy('admins');
    setSlug('');
    setError(null);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const slugInvalid = visibility === 'public' && !SLUG_PATTERN.test(slug);
  const canSubmit = title.trim().length > 0 && !slugInvalid && !createChannel.isPending;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      const conversation = await createChannel.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        posting_policy: postingPolicy,
        slug: visibility === 'public' ? slug.trim() : undefined,
      });
      onCreated(conversation.conversation_id);
      close();
    } catch (err) {
      setError(extractApiError(err, 'Could not create channel'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-md rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle>New channel</DialogTitle>
          <DialogDescription>Broadcast to members, or make it public and joinable.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="channel-title">Name</Label>
            <Input
              id="channel-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Announcements"
              maxLength={80}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="channel-description">Description</Label>
            <textarea
              id="channel-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this channel about?"
              maxLength={500}
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Visibility</Label>
              <ChoicePills<Visibility>
                value={visibility}
                onChange={setVisibility}
                options={[
                  { value: 'private', label: 'Private' },
                  { value: 'public', label: 'Public' },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Who can post</Label>
              <ChoicePills<PostingPolicy>
                value={postingPolicy}
                onChange={setPostingPolicy}
                options={[
                  { value: 'admins', label: 'Admins' },
                  { value: 'everyone', label: 'Everyone' },
                ]}
              />
            </div>
          </div>

          {visibility === 'public' ? (
            <div className="space-y-1.5">
              <Label htmlFor="channel-slug">Public link (slug)</Label>
              <Input
                id="channel-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value.toLowerCase())}
                placeholder="announcements"
                maxLength={80}
              />
              {slug && slugInvalid ? (
                <p className="text-xs text-destructive">
                  Use 3–80 lowercase letters, numbers, or hyphens.
                </p>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={createChannel.isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
            {createChannel.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating
              </>
            ) : (
              'Create channel'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
