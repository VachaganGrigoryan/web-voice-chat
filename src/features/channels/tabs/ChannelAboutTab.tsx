import { Globe, Hash, Lock, MessageSquare, Users } from 'lucide-react';
import type { Channel } from '@/api/types';
import { PanelSection } from '@/components/panel/PanelPageLayout';

const VISIBILITY_LABEL: Record<Channel['visibility'], string> = {
  public: 'Anyone can read this channel',
  members: 'Only members can read this channel',
  private: 'Private — invite only',
};

const POSTING_LABEL: Record<Channel['posting_policy'], string> = {
  owner: 'Only the owner can post',
  moderators: 'Owner and moderators can post',
  members: 'Members can post',
  everyone: 'Anyone can post',
};

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/70 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}

export function ChannelAboutTab({ channel }: { channel: Channel }) {
  return (
    <PanelSection title="About" description={channel.description || undefined}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Fact icon={Hash} label="Handle" value={`#${channel.slug}`} />
        <Fact
          icon={channel.visibility === 'public' ? Globe : Lock}
          label="Visibility"
          value={VISIBILITY_LABEL[channel.visibility]}
        />
        <Fact
          icon={MessageSquare}
          label="Posting"
          value={POSTING_LABEL[channel.posting_policy]}
        />
        <Fact
          icon={Users}
          label="Followers"
          value={`${channel.follower_count} ${channel.follower_count === 1 ? 'follower' : 'followers'}`}
        />
      </div>

      {channel.tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {channel.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border/70 bg-muted/60 px-2.5 py-1 text-2xs font-medium text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </PanelSection>
  );
}
