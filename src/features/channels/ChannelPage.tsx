import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, UserPlus } from 'lucide-react';
import { Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { channelsApi, membershipsApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import type {
  ChannelCommentPolicy,
  ChannelPostingPolicy,
  ChannelVisibility,
} from '@/api/types';
import { APP_ROUTES } from '@/app/routes';
import { FollowButton } from '@/components/FollowButton';
import { PanelPageLayout, PanelSection } from '@/components/panel/PanelPageLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useAppNavigation } from '@/navigation/appNavigation';
import { useAuthStore } from '@/store/authStore';
import { ProfileChannelTimeline } from '@/features/profile/components/ProfileChannelTimeline';

export default function ChannelPage() {
  const { channelId } = useParams<{ channelId?: string }>();
  const currentUserId = useAuthStore((state) => state.userId);
  const queryClient = useQueryClient();
  const { goBack } = useAppNavigation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<ChannelVisibility>('public');
  const [postingPolicy, setPostingPolicy] =
    useState<ChannelPostingPolicy>('everyone');
  const [commentPolicy, setCommentPolicy] =
    useState<ChannelCommentPolicy>('everyone');

  const channelQuery = useQuery({
    queryKey: ['channels', channelId],
    queryFn: () => channelsApi.get(channelId as string),
    enabled: Boolean(channelId),
  });
  const channel = channelQuery.data;
  const isOwner = Boolean(
    channel &&
      currentUserId &&
      channel.owner.type === 'user' &&
      channel.owner.id === currentUserId
  );

  useEffect(() => {
    if (!channel) return;
    setName(channel.name);
    setDescription(channel.description ?? '');
    setVisibility(channel.visibility);
    setPostingPolicy(channel.posting_policy);
    setCommentPolicy(channel.comment_policy);
  }, [channel]);

  const updateChannel = useMutation({
    mutationFn: () =>
      channelsApi.update(channelId as string, {
        name: name.trim(),
        description: description.trim() || null,
        visibility,
        posting_policy: postingPolicy,
        comment_policy: commentPolicy,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['channels', updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ['user-channels'] });
      toast.success('Channel updated');
    },
    onError: (error) => toast.error(extractApiError(error, 'Could not update channel')),
  });

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
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background p-6 text-sm text-muted-foreground">
        Channel not found.
      </div>
    );
  }

  return (
    <PanelPageLayout
      title={channel.name}
      description={`#${channel.slug} · ${channel.kind}`}
      onBack={() => goBack({ fallback: APP_ROUTES.feeds })}
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
        </div>
      }
    >
      <div className="space-y-6">
        <PanelSection
          title="Channel feed"
          description={channel.description || 'Posts and comments from this channel.'}
        >
          <ProfileChannelTimeline channelId={channel.id} />
        </PanelSection>

        {isOwner ? (
          <PanelSection
            title="Manage channel"
            description="Update the channel details and posting policies."
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="manage-channel-name">Name</Label>
                  <Input
                    id="manage-channel-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={80}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manage-channel-visibility">Visibility</Label>
                  <select
                    id="manage-channel-visibility"
                    value={visibility}
                    onChange={(event) =>
                      setVisibility(event.target.value as ChannelVisibility)
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="public">Public</option>
                    <option value="members">Members</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manage-channel-description">Description</Label>
                <textarea
                  id="manage-channel-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="manage-posting-policy">Who can post</Label>
                  <select
                    id="manage-posting-policy"
                    value={postingPolicy}
                    onChange={(event) =>
                      setPostingPolicy(event.target.value as ChannelPostingPolicy)
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="owner">Owner</option>
                    <option value="moderators">Moderators</option>
                    <option value="members">Members</option>
                    <option value="everyone">Everyone</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="manage-comment-policy">Who can comment</Label>
                  <select
                    id="manage-comment-policy"
                    value={commentPolicy}
                    onChange={(event) =>
                      setCommentPolicy(event.target.value as ChannelCommentPolicy)
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="disabled">Nobody</option>
                    <option value="followers">Followers</option>
                    <option value="members">Members</option>
                    <option value="everyone">Everyone</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={!name.trim() || updateChannel.isPending}
                  onClick={() => updateChannel.mutate()}
                >
                  {updateChannel.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save changes
                </Button>
              </div>
            </div>
          </PanelSection>
        ) : null}
      </div>
    </PanelPageLayout>
  );
}
