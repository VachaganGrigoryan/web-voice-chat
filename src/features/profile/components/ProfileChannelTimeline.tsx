import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Loader2, Send, X } from 'lucide-react';
import { toast } from 'sonner';

import { messagesApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import { useChannelFeed } from '@/hooks/useChannelFeed';

import { ProfilePostCard } from './ProfilePostCard';

interface ProfilePostComposerProps {
  channelId: string;
}

function ProfilePostComposer({ channelId }: ProfilePostComposerProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [image, setImage] = useState<File | null>(null);

  const reset = () => {
    setText('');
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const publishMutation = useMutation({
    mutationFn: async () => {
      const trimmed = text.trim();
      if (image) {
        return messagesApi.uploadMedia({
          conversation_id: channelId,
          file: image,
          type: 'media',
          media_kind: 'image',
          text: trimmed || undefined,
        });
      }
      return messagesApi.sendText({ conversation_id: channelId, text: trimmed });
    },
    onSuccess: () => {
      reset();
      queryClient.invalidateQueries({ queryKey: ['channel-feed', channelId] });
    },
    onError: (error) => toast.error(extractApiError(error, 'Could not publish post')),
  });

  const canSend = (text.trim().length > 0 || image !== null) && !publishMutation.isPending;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <label htmlFor="profile-post-input" className="sr-only">
        Write a post
      </label>
      <textarea
        id="profile-post-input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Share something on your channel…"
        rows={3}
        className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />

      {image ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <span className="truncate">{image.name}</span>
          <button
            type="button"
            onClick={() => {
              setImage(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            aria-label="Remove image"
            className="ml-auto rounded p-0.5 hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className="mt-2 flex items-center justify-between">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => setImage(event.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="mr-2 h-4 w-4" />
          Image
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => canSend && publishMutation.mutate()}
          disabled={!canSend}
        >
          {publishMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Post
        </Button>
      </div>
    </div>
  );
}

interface ProfileChannelTimelineProps {
  channelId: string;
  canPost: boolean;
}

export function ProfileChannelTimeline({ channelId, canPost }: ProfileChannelTimelineProps) {
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useChannelFeed(channelId);

  // Backend already returns newest-first; keep that order for a timeline.
  const posts = data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="space-y-4">
      {canPost ? <ProfilePostComposer channelId={channelId} /> : null}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Failed to load posts.
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          {canPost ? 'No posts yet. Share your first post above.' : 'No posts yet.'}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <ProfilePostCard key={post.id} post={post} channelId={channelId} canManage={canPost} />
          ))}
          {hasNextPage ? (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Load older posts
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
