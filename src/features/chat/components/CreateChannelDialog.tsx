import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { channelsApi } from '@/api/endpoints';
import type {
  ChannelCommentPolicy,
  ChannelPostingPolicy,
  ChannelVisibility,
} from '@/api/types';

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;

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

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (channelId: string) => void;
  defaultVisibility?: ChannelVisibility;
}

export function CreateChannelDialog({
  open,
  onOpenChange,
  onCreated,
  defaultVisibility = 'public',
}: CreateChannelDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<ChannelVisibility>(defaultVisibility);
  const [postingPolicy, setPostingPolicy] = useState<ChannelPostingPolicy>('owner');
  const [commentPolicy, setCommentPolicy] =
    useState<ChannelCommentPolicy>('everyone');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createChannel = useMutation({
    mutationFn: channelsApi.create,
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ['user-channels'] });
      queryClient.invalidateQueries({ queryKey: ['feeds'] });
      onCreated(channel.id);
    },
  });

  const reset = () => {
    setTitle('');
    setDescription('');
    setVisibility(defaultVisibility);
    setPostingPolicy('owner');
    setCommentPolicy('everyone');
    setSlug('');
    setError(null);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const slugInvalid = !SLUG_PATTERN.test(slug);
  const canSubmit =
    title.trim().length > 0 &&
    slug.trim().length > 0 &&
    !slugInvalid &&
    !createChannel.isPending;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    try {
      await createChannel.mutateAsync({
        name: title.trim(),
        slug: slug.trim(),
        kind: 'text',
        description: description.trim() || undefined,
        visibility,
        posting_policy: postingPolicy,
        comment_policy: commentPolicy,
        join_policy: visibility === 'public' ? 'open' : 'invite_only',
      });
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
              <ChoicePills<ChannelVisibility>
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
              <ChoicePills<ChannelPostingPolicy>
                value={postingPolicy}
                onChange={setPostingPolicy}
                options={[
                  { value: 'owner', label: 'Owner' },
                  { value: 'everyone', label: 'Everyone' },
                ]}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Who can comment</Label>
            <ChoicePills<ChannelCommentPolicy>
              value={commentPolicy}
              onChange={setCommentPolicy}
              options={[
                { value: 'disabled', label: 'Nobody' },
                { value: 'followers', label: 'Followers' },
                { value: 'everyone', label: 'Everyone' },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="channel-slug">Channel slug</Label>
            <Input
              id="channel-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value.toLowerCase())}
              placeholder="announcements"
              maxLength={80}
            />
            {slug && slugInvalid ? (
              <p className="text-xs text-destructive">
                Use 1–80 lowercase letters, numbers, or hyphens.
              </p>
            ) : null}
          </div>

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
