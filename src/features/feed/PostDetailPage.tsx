import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { channelsApi, messagesApi, usersApi } from '@/api/endpoints';
import { resolveMessageContent } from '@/api/messageContent';
import type { FeedAuthor, FeedPostView } from '@/api/types';
import { APP_ROUTES } from '@/app/routes';
import { PageBody } from '@/components/page/PageBody';
import { PageHeader } from '@/components/page/PageHeader';
import { ProfilePostCard } from '@/features/profile/components/ProfilePostCard';
import { useFeedPostCapabilities } from './useFeedPostCapabilities';
import { useAppNavigation } from '@/navigation/appNavigation';
import { useAuthStore } from '@/store/authStore';

export default function PostDetailPage() {
  const { channelId, postId } = useParams<{ channelId?: string; postId?: string }>();
  const { goBack } = useAppNavigation();
  const currentUserId = useAuthStore((state) => state.userId);

  const messageQuery = useQuery({
    queryKey: ['messages', postId],
    queryFn: () => messagesApi.getMessage(postId as string),
    enabled: Boolean(postId),
    retry: false,
  });

  const channelQuery = useQuery({
    queryKey: ['channels', channelId],
    queryFn: () => channelsApi.get(channelId as string),
    enabled: Boolean(channelId),
  });

  const { for: capabilitiesFor } = useFeedPostCapabilities(channelId ? [channelId] : []);

  const doc = messageQuery.data;

  const authorQuery = useQuery({
    queryKey: ['users', doc?.sender_id],
    queryFn: () => usersApi.getUser(doc?.sender_id as string),
    enabled: Boolean(doc?.sender_id),
  });

  const post: FeedPostView | null = useMemo(() => {
    if (!doc) return null;
    const resolved = resolveMessageContent(doc);
    const author: FeedAuthor = authorQuery.data
      ? {
          id: authorQuery.data.id,
          username: authorQuery.data.username,
          display_name: authorQuery.data.display_name,
          avatar: authorQuery.data.avatar,
        }
      : { id: doc.sender_id, username: null, display_name: null, avatar: null };

    return {
      id: doc.id,
      channel_id: doc.container_id,
      author,
      type: doc.type,
      text: resolved.text,
      attachments: resolved.attachments,
      reactions: doc.reactions,
      comment_count: doc.thread_reply_count,
      has_thread: doc.is_thread_root || doc.thread_reply_count > 0,
      is_deleted: doc.is_deleted ?? false,
      created_at: doc.created_at,
      edited_at: doc.edited_at,
    };
  }, [doc, authorQuery.data]);

  if (!channelId || !postId) {
    return <Navigate to={APP_ROUTES.feed} replace />;
  }

  // A comment notification points at the reply itself; resolve to the thread
  // root so the canonical URL always names the post, not one of its comments.
  if (doc?.thread_root_id && doc.thread_root_id !== postId) {
    return <Navigate to={APP_ROUTES.channelPost(channelId, doc.thread_root_id)} replace />;
  }

  // Resolved, not derived from `comment_policy` at the call site.
  const { canComment, canReact } = capabilitiesFor(channelId);
  const channel = channelQuery.data;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <PageHeader
        title="Post"
        description={channel?.name ? `In #${channel.name}` : undefined}
        onBack={() => goBack({ fallback: APP_ROUTES.channel(channelId) })}
      />
      <PageBody narrow>
        {messageQuery.isError ? (
          <div className="rounded-2xl border border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
            This post is unavailable or you don&apos;t have access to it.
          </div>
        ) : messageQuery.isLoading || !post ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ProfilePostCard
            post={post}
            channelId={channelId}
            canComment={canComment}
            canReact={canReact}
            currentUserId={currentUserId}
            defaultShowComments
          />
        )}
      </PageBody>
    </div>
  );
}
