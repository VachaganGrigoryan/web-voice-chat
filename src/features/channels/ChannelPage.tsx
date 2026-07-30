import { Info, Loader2, MessageSquare, Rss, Settings, UserPlus, Users } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { channelsApi, membershipsApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import { APP_ROUTES, ChannelTab, isChannelTab } from '@/app/routes';
import { FollowButton } from '@/components/FollowButton';
import { PanelPageLayout, PanelSection } from '@/components/panel/PanelPageLayout';
import { PageTabs } from '@/components/page/PageTabs';
import type { PageTab } from '@/components/page/pageTypes';
import { Button } from '@/components/ui/Button';
import { useChannelManagement } from '@/hooks/useChannelManagement';
import { ChannelAboutTab } from './tabs/ChannelAboutTab';
import { ChannelMembersTab } from './tabs/ChannelMembersTab';
import { useAppNavigation } from '@/navigation/appNavigation';
import { ProfileChannelTimeline } from '@/features/profile/components/ProfileChannelTimeline';

export default function ChannelPage() {
  const { spaceId, channelId, tab } = useParams<{
    spaceId?: string;
    channelId?: string;
    tab?: string;
  }>();
  const navigate = useNavigate();
  const { goBack } = useAppNavigation();

  const channelQuery = useQuery({
    queryKey: ['channels', channelId],
    queryFn: () => channelsApi.get(channelId as string),
    enabled: Boolean(channelId),
  });
  const channel = channelQuery.data;
  const management = useChannelManagement(channelId ?? null);
  const isOwner = management.isOwner;
  // Management is a role question, not an ownership question: a space-owned
  // channel has no user owner, so the old owner-only check hid every control.
  const canManage = management.canManage;
  const activeTab: ChannelTab = isChannelTab(tab) ? tab : 'feed';
  const ownerSpaceId = spaceId ?? channel?.space_id ?? null;
  const channelPath = (next: ChannelTab) =>
    ownerSpaceId
      ? APP_ROUTES.spaceChannel(ownerSpaceId, channelId as string, next)
      : next === 'feed'
        ? APP_ROUTES.channel(channelId as string)
        : `${APP_ROUTES.channel(channelId as string)}/${next}`;

  const channelTabs: readonly PageTab[] = [
    { id: 'feed', label: 'Feed', icon: Rss },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'about', label: 'About', icon: Info },
    { id: 'members', label: 'Members', icon: Users, count: management.members.length },
  ];

  const joinChannel = useMutation({
    mutationFn: () => membershipsApi.join('channel', channelId as string),
    onSuccess: (relationship) => {
      toast.success(
        relationship.status === 'pending' ? 'Join request sent' : 'Joined channel'
      );
    },
    onError: (error) => toast.error(extractApiError(error, 'Could not join channel')),
  });

  if (!channelId) {
    return <Navigate to={APP_ROUTES.feeds} replace />;
  }

  if (channelQuery.isLoading) {
    return (
      <div className="flex min-h-full min-h-0 w-full items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex min-h-full min-h-0 w-full items-center justify-center bg-background p-6 text-sm text-muted-foreground">
        Channel not found.
      </div>
    );
  }

  if (activeTab === 'chat') {
    return (
      <Navigate
        to={
          ownerSpaceId
            ? APP_ROUTES.spaceChannel(ownerSpaceId, channel.id, 'chat')
            : APP_ROUTES.chatChannel(channel.id)
        }
        replace
      />
    );
  }

  return (
    <PanelPageLayout
      title={channel.name}
      description={`#${channel.slug} · ${channel.kind}`}
      onBack={() => goBack({ fallback: ownerSpaceId ? APP_ROUTES.spaceDetailTab(ownerSpaceId, 'channels') : APP_ROUTES.feed })}
      nav={
        <PageTabs
          tabs={channelTabs}
          activeTabId={activeTab}
          onSelect={(tabId) => navigate(channelPath(tabId as ChannelTab))}
          aria-label="Channel sections"
        />
      }
      headerActions={
        <div className="flex items-center gap-2">
          {!isOwner ? <FollowButton targetType="channel" targetId={channel.id} /> : null}
          {!isOwner && channel.join_policy !== 'closed' ? (
            <Button
              type="button"
              size="sm"
              disabled={joinChannel.isPending}
              onClick={() => joinChannel.mutate()}
            >
              {joinChannel.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Join
            </Button>
          ) : null}
          {canManage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                navigate(
                  ownerSpaceId
                    ? APP_ROUTES.spaceChannelManage(ownerSpaceId, channel.id)
                    : APP_ROUTES.channelManage(channel.id)
                )
              }
            >
              <Settings className="mr-2 h-4 w-4" />
              Manage
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-6">
        {activeTab === 'feed' ? (
          <PanelSection
            title="Channel feed"
            description={channel.description || 'Posts and comments from this channel.'}
          >
            <ProfileChannelTimeline channelId={channel.id} />
          </PanelSection>
        ) : null}

        {activeTab === 'about' ? <ChannelAboutTab channel={channel} /> : null}

        {activeTab === 'members' ? (
          <ChannelMembersTab channelId={channel.id} management={management} />
        ) : null}
      </div>
    </PanelPageLayout>
  );
}
