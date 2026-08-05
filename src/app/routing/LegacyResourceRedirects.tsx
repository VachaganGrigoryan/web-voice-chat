import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { channelsApi, conversationsApi, directoryApi } from '@/api/endpoints';
import { directoryKeys } from '@/api/queryKeys';
import { APP_ROUTES, ChannelTab, channelLensFromPath, isChannelTab } from '@/app/routes';
import ChannelPage from '@/features/channels/ChannelPage';
import ChatPage from '@/features/chat/ChatPage';

const getCanonicalConversationPath = (
  conversation: Awaited<ReturnType<typeof conversationsApi.getConversation>>,
  rootMessageId?: string
) => {
  const id = conversation.id;
  const spaceId = conversation.space_id;

  if (conversation.type === 'dm') {
    return rootMessageId ? APP_ROUTES.dmThread(id, rootMessageId) : APP_ROUTES.dm(id);
  }

  if (spaceId) {
    return rootMessageId
      ? APP_ROUTES.spaceGroupThread(spaceId, id, rootMessageId)
      : APP_ROUTES.spaceGroupChat(spaceId, id);
  }

  return rootMessageId ? APP_ROUTES.groupThread(id, rootMessageId) : APP_ROUTES.group(id);
};

export function LegacyConversationRedirect() {
  const { conversationId, rootMessageId } = useParams<{
    conversationId?: string;
    rootMessageId?: string;
  }>();
  const conversationQuery = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => conversationsApi.getConversation(conversationId as string),
    enabled: !!conversationId,
    retry: false,
  });

  if (!conversationId) {
    return <Navigate to={APP_ROUTES.chat} replace />;
  }

  if (!conversationQuery.data) {
    return null;
  }

  return (
    <Navigate
      to={getCanonicalConversationPath(conversationQuery.data, rootMessageId)}
      replace
    />
  );
}

const mapLegacyChannelTab = (tab?: string): ChannelTab => {
  if (!tab || tab === 'settings' || tab === 'manage') return 'feed';
  return isChannelTab(tab) ? tab : 'feed';
};

export function LegacyChannelRedirect() {
  const { channelId, tab } = useParams<{ channelId?: string; tab?: string }>();
  const channelQuery = useQuery({
    queryKey: ['channels', channelId],
    queryFn: () => channelsApi.get(channelId as string),
    enabled: !!channelId,
    retry: false,
  });

  if (!channelId) {
    return <Navigate to={APP_ROUTES.feed} replace />;
  }

  if (!channelQuery.data) {
    return null;
  }

  const channel = channelQuery.data;
  if (!channel.space_id) {
    return <ChannelPage />;
  }

  return (
    <Navigate
      to={APP_ROUTES.spaceChannel(channel.space_id, channel.id, mapLegacyChannelTab(tab))}
      replace
    />
  );
}

export function LegacyChannelChatRedirect() {
  const { channelId, rootMessageId } = useParams<{
    channelId?: string;
    rootMessageId?: string;
  }>();
  const lens = channelLensFromPath(useLocation().pathname);
  const channelQuery = useQuery({
    queryKey: ['channels', channelId],
    queryFn: () => channelsApi.get(channelId as string),
    enabled: !!channelId,
    retry: false,
  });

  if (!channelId) {
    return <Navigate to={APP_ROUTES.chat} replace />;
  }

  if (!channelQuery.data) {
    return null;
  }

  const channel = channelQuery.data;
  if (!channel.space_id) {
    return <ChatPage />;
  }

  return (
    <Navigate
      to={
        rootMessageId
          ? APP_ROUTES.spaceChannelThread(channel.space_id, channel.id, rootMessageId)
          : // The lens the legacy path named is preserved, so a shared
            // `/chat/channels/:id/feed` link still lands in the feed.
            APP_ROUTES.spaceChannel(channel.space_id, channel.id, lens)
      }
      replace
    />
  );
}

export function LegacyUserFeedRedirect() {
  const { username } = useParams<{ username?: string }>();
  const normalized = username?.replace(/^@/, '').trim() ?? '';

  const peopleQuery = useQuery({
    queryKey: directoryKeys.list('people', { q: normalized }),
    queryFn: () => directoryApi.listPeople({ q: normalized, limit: 10 }),
    enabled: !!normalized,
    retry: false,
  });

  if (!normalized) {
    return <Navigate to={APP_ROUTES.feed} replace />;
  }

  if (peopleQuery.isLoading) {
    return null;
  }

  const match = peopleQuery.data?.data.find(
    (user) => user.username?.toLowerCase() === normalized.toLowerCase()
  );

  if (match) {
    return <Navigate to={APP_ROUTES.profile(match.id)} replace />;
  }

  return (
    <div className="flex h-full items-center justify-center p-10 text-center text-sm text-muted-foreground">
      This profile could not be found.
    </div>
  );
}

export function LegacyChannelFeedRedirect() {
  const { channelId } = useParams<{ channelId?: string }>();
  return channelId ? (
    <LegacyChannelRedirect />
  ) : (
    <Navigate to={APP_ROUTES.feed} replace />
  );
}
