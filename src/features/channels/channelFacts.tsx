import { Globe, Hash, Lock, MessageSquare, Users } from 'lucide-react';
import type { Channel } from '@/api/types';
import { cn } from '@/lib/utils';

/**
 * How a channel describes itself, in one place.
 *
 * These were private to the about tab. The header summary needs the same three
 * things, and a channel must not be able to describe its own visibility one way
 * on a tab and another way in a modal.
 */

export const CHANNEL_VISIBILITY_LABEL: Record<Channel['visibility'], string> = {
  public: 'Anyone can read this channel',
  members: 'Only members can read this channel',
  private: 'Private — invite only',
};

export const CHANNEL_POSTING_LABEL: Record<Channel['posting_policy'], string> = {
  owner: 'Only the owner can post',
  moderators: 'Owner and moderators can post',
  members: 'Members can post',
  everyone: 'Anyone can post',
};

export function ChannelFact({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border border-border/70 p-4', className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 text-sm">{value}</div>
      </div>
    </div>
  );
}

/** The four facts every channel surface shows, in one order. */
export function ChannelFactGrid({ channel, className }: { channel: Channel; className?: string }) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', className)}>
      <ChannelFact icon={Hash} label="Handle" value={`#${channel.slug}`} />
      <ChannelFact
        icon={channel.visibility === 'public' ? Globe : Lock}
        label="Visibility"
        value={CHANNEL_VISIBILITY_LABEL[channel.visibility]}
      />
      <ChannelFact
        icon={MessageSquare}
        label="Posting"
        value={CHANNEL_POSTING_LABEL[channel.posting_policy]}
      />
      <ChannelFact
        icon={Users}
        label="Followers"
        value={`${channel.follower_count} ${channel.follower_count === 1 ? 'follower' : 'followers'}`}
      />
    </div>
  );
}

export function ChannelTagList({ tags }: { tags: readonly string[] }) {
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-border/70 bg-muted/60 px-2.5 py-1 text-2xs font-medium text-muted-foreground"
        >
          #{tag}
        </span>
      ))}
    </div>
  );
}
