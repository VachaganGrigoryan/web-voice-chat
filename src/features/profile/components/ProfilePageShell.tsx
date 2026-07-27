import { useState, type ReactNode } from 'react';
import { Loader2, Pin, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { extractApiError } from '@/api/errors';
import type { UserChannelView } from '@/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { CreateChannelDialog } from '@/features/chat/components/CreateChannelDialog';
import { useProfile } from '@/hooks/useProfile';
import {
  useFollowerRelationships,
  useFollowingRelationships,
} from '@/hooks/useFollowRelationships';
import { useUserChannels } from '@/hooks/useUserChannels';
import { cn } from '@/lib/utils';
import { APP_ROUTES } from '@/app/routes';

import { ProfileChannelTimeline } from './ProfileChannelTimeline';
import { FollowListDialog } from './FollowListDialog';

export interface ProfileDetailItem {
  label: string;
  value: string;
}

interface ProfilePageShellProps {
  isOwner: boolean;
  userId: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  bio: string | null;
  statusLabel: string | null;
  details: ProfileDetailItem[];
  headerActions?: ReactNode;
  isLoading?: boolean;
}

const ABOUT_TAB = 'about';

export function ProfilePageShell({
  isOwner,
  userId,
  displayName,
  username,
  avatarUrl,
  bio,
  statusLabel,
  details,
  headerActions,
  isLoading = false,
}: ProfilePageShellProps) {
  const { data: channels = [], isLoading: channelsLoading } = useUserChannels(userId);
  const { setMainChannel, isSettingMainChannel } = useProfile();
  const followersQuery = useFollowerRelationships(userId);
  const followingQuery = useFollowingRelationships(userId);

  const [selectedTab, setSelectedTab] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [followListMode, setFollowListMode] = useState<'followers' | 'following' | null>(
    null
  );
  const followers = followersQuery.data ?? [];
  const following = followingQuery.data ?? [];
  const followerCount = followers.filter((item) => item.status === 'active').length;
  const followingCount = following.filter((item) => item.status === 'active').length;

  // Default to the first (main-first) channel; fall back to About.
  const activeTab = selectedTab ?? channels[0]?.id ?? ABOUT_TAB;
  const activeChannel = channels.find((channel) => channel.id === activeTab) ?? null;

  const handleCreated = async (channelId: string) => {
    // Auto-pin the very first channel as the profile's main timeline.
    if (channels.length === 0) {
      try {
        await setMainChannel(channelId);
      } catch (error) {
        toast.error(extractApiError(error, 'Channel created, but could not pin it as main'));
      }
    }
    setSelectedTab(channelId);
  };

  const handleSetMain = async (channel: UserChannelView) => {
    try {
      await setMainChannel(channel.id);
      toast.success(`“${channel.title ?? 'Channel'}” is now your main channel`);
    } catch (error) {
      toast.error(extractApiError(error, 'Could not set main channel'));
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Cover band */}
      <div className="h-40 w-full bg-gradient-to-r from-primary/25 via-muted to-secondary/25 sm:h-56" />

      <div className="mx-auto -mt-16 w-full max-w-4xl px-4 pb-16 sm:-mt-20 sm:px-6">
        <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:gap-6 sm:text-left">
          <Avatar className="h-28 w-28 shrink-0 border-4 border-background shadow-md sm:h-36 sm:w-36">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" /> : null}
            <AvatarFallback className="bg-muted text-4xl">
              {displayName[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1 space-y-1 pb-1">
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{displayName}</h1>
            {username ? <p className="truncate text-sm text-muted-foreground">{username}</p> : null}
            {statusLabel ? <p className="truncate text-sm text-foreground">{statusLabel}</p> : null}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pb-1 sm:justify-end">
            {isOwner ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New channel
              </Button>
            ) : null}
            {headerActions}
          </div>
        </header>

        <div className="mt-4 flex justify-center gap-5 text-sm sm:justify-start sm:pl-40">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setFollowListMode('followers')}
          >
            <span className="font-semibold text-foreground">{followerCount}</span> followers
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => setFollowListMode('following')}
          >
            <span className="font-semibold text-foreground">{followingCount}</span> following
          </button>
          {username ? (
            <Link
              to={APP_ROUTES.userFeed(username.replace(/^@/, ''))}
              className="font-medium text-primary hover:underline"
            >
              View feed
            </Link>
          ) : null}
        </div>

        {/* Channel tabs */}
        <nav className="mt-6 flex gap-2 overflow-x-auto border-b border-border pb-px">
          {channels.map((channel) => (
            <button
              key={channel.id}
              type="button"
              onClick={() => setSelectedTab(channel.id)}
              className={cn(
                'flex shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                activeTab === channel.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {channel.is_main ? <Pin className="h-3.5 w-3.5" aria-hidden /> : null}
              {channel.title || 'Untitled'}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedTab(ABOUT_TAB)}
            className={cn(
              'shrink-0 cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              activeTab === ABOUT_TAB
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            About
          </button>
        </nav>

        {/* Tab content */}
        <div className="mt-6">
          {isLoading || channelsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeTab === ABOUT_TAB ? (
            <AboutTab bio={bio} details={details} />
          ) : activeChannel ? (
            <div className="space-y-4">
              {isOwner && !activeChannel.is_main ? (
                <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 px-4 py-2.5">
                  <span className="text-sm text-muted-foreground">Not your main channel</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleSetMain(activeChannel)}
                    disabled={isSettingMainChannel}
                  >
                    {isSettingMainChannel ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Pin className="mr-2 h-4 w-4" />
                    )}
                    Set as main
                  </Button>
                </div>
              ) : null}
              <ProfileChannelTimeline channelId={activeChannel.id} />
            </div>
          ) : isOwner ? (
            <EmptyChannelsState onCreate={() => setCreateOpen(true)} />
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              This user hasn’t created any channels yet.
            </div>
          )}
        </div>
      </div>

      {isOwner ? (
        <CreateChannelDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(id) => void handleCreated(id)}
          defaultVisibility="public"
        />
      ) : null}
      <FollowListDialog
        open={followListMode === 'followers'}
        onOpenChange={(open) => setFollowListMode(open ? 'followers' : null)}
        mode="followers"
        relationships={followers}
      />
      <FollowListDialog
        open={followListMode === 'following'}
        onOpenChange={(open) => setFollowListMode(open ? 'following' : null)}
        mode="following"
        relationships={following}
      />
    </div>
  );
}

function AboutTab({ bio, details }: { bio: string | null; details: ProfileDetailItem[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Bio</h2>
        {bio ? (
          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{bio}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No bio yet.</p>
        )}
      </div>
      {details.length > 0 ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          {details.map((item) => (
            <div key={item.label} className="rounded-2xl border border-border bg-muted/30 px-4 py-3">
              <dt className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                {item.label}
              </dt>
              <dd className="mt-1 break-words text-sm font-medium text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function EmptyChannelsState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-10 text-center">
      <h2 className="text-lg font-semibold text-foreground">Create your channel to start posting</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Channels are your public timeline. Create one, pin it as your main channel, and everyone who
        visits your page can follow your posts.
      </p>
      <Button type="button" className="mt-4" onClick={onCreate}>
        <Plus className="mr-2 h-4 w-4" />
        Create channel
      </Button>
    </div>
  );
}
