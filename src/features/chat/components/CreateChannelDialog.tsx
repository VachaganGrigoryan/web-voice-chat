import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { channelsApi, spacesApi } from '@/api/endpoints';
import { useActiveSpace } from '@/app/shell/useActiveSpace';
import type {
  ChannelCommentPolicy,
  ChannelPostingPolicy,
  ChannelVisibility,
  SpaceView,
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
  selectedSpaceId?: string | null;
}

export function CreateChannelDialog({
  open,
  onOpenChange,
  onCreated,
  defaultVisibility = 'public',
  selectedSpaceId,
}: CreateChannelDialogProps) {
  const queryClient = useQueryClient();
  const activeSpaceIdFromStore = useActiveSpace((s) => s.activeSpaceId);
  const currentSpaceId = selectedSpaceId !== undefined ? selectedSpaceId : activeSpaceIdFromStore;

  const spacesQuery = useQuery<SpaceView[]>({
    queryKey: ['spaces'],
    queryFn: () => spacesApi.list(),
  });
  const spaces = spacesQuery.data ?? [];
  const vogiSpace = spaces.find((s) => s.is_default || s.slug === 'vogi');
  const defaultSpaceId = currentSpaceId || vogiSpace?.id || '';

  const [targetSpaceId, setTargetSpaceId] = useState<string>(defaultSpaceId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<ChannelVisibility>(defaultVisibility);
  const [postingPolicy, setPostingPolicy] = useState<ChannelPostingPolicy>('owner');
  const [commentPolicy, setCommentPolicy] = useState<ChannelCommentPolicy>('everyone');
  const [slug, setSlug] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (defaultSpaceId && !targetSpaceId) {
      setTargetSpaceId(defaultSpaceId);
    }
  }, [defaultSpaceId, targetSpaceId]);

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
    !isSubmitting;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const effectiveSpaceId = targetSpaceId || vogiSpace?.id || currentSpaceId;
      const payload = {
        name: title.trim(),
        slug: slug.trim(),
        kind: 'text' as const,
        description: description.trim() || undefined,
        visibility,
        posting_policy: postingPolicy,
        comment_policy: commentPolicy,
        join_policy: visibility === 'public' ? ('open' as const) : ('invite_only' as const),
      };

      const channel = effectiveSpaceId
        ? await spacesApi.createChannel(effectiveSpaceId, payload)
        : await channelsApi.create(payload);

      queryClient.invalidateQueries({ queryKey: ['user-channels'] });
      queryClient.invalidateQueries({ queryKey: ['channels', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['space-channels'] });
      queryClient.invalidateQueries({ queryKey: ['feeds'] });

      // No space was picked (none existed to pick from), so the backend
      // silently filed it under the default space — say so rather than
      // leaving the placement a surprise.
      if (!effectiveSpaceId) {
        toast.success('Channel created in Vogi, the default space.');
      }

      onCreated(channel.id);
      close();
    } catch (err) {
      setError(extractApiError(err, 'Could not create channel'));
    } finally {
      setIsSubmitting(false);
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
          {spaces.length > 0 ? (
            <div className="space-y-1.5">
              <Label htmlFor="channel-space">Space</Label>
              <select
                id="channel-space"
                value={targetSpaceId || defaultSpaceId}
                onChange={(e) => setTargetSpaceId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {(s.is_default || s.slug === 'vogi') ? '(Public default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              No space selected — this channel will be created in Vogi, the default space.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="channel-title">Name</Label>
            <Input
              id="channel-title"
              value={title}
              onChange={(event) => {
                const val = event.target.value;
                setTitle(val);
                setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
              }}
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
          <Button type="button" variant="outline" onClick={close} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={!canSubmit}>
            {isSubmitting ? (
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
