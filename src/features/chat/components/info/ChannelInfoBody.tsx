import { Hash, Megaphone } from 'lucide-react';

import type { Channel } from '@/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { ChannelFactGrid, ChannelTagList } from '@/features/channels/channelFacts';

/**
 * A channel's identity and facts, read straight off the descriptor's channel —
 * no request, because everything shown is already loaded to render the chat.
 */
export function ChannelInfoBody({ channel }: { channel: Channel }) {
  const KindIcon = channel.kind === 'announcement' ? Megaphone : Hash;

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        <Avatar className="h-20 w-20 border">
          {channel.avatar?.url ? (
            <AvatarImage src={channel.avatar.url} alt={channel.name} className="object-cover" />
          ) : null}
          <AvatarFallback className="bg-brand-muted text-brand">
            <KindIcon className="h-7 w-7" />
          </AvatarFallback>
        </Avatar>

        <div className="space-y-0.5 text-center">
          <div className="text-base font-semibold">{channel.name}</div>
          <div className="text-sm text-muted-foreground">
            {channel.message_count} post{channel.message_count === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {channel.description ? (
        <p className="whitespace-pre-wrap break-words text-center text-sm text-muted-foreground">
          {channel.description}
        </p>
      ) : null}

      <ChannelFactGrid channel={channel} className="sm:grid-cols-1" />
      <ChannelTagList tags={channel.tags} />
    </div>
  );
}
