import type { Channel } from '@/api/types';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { ChannelFactGrid, ChannelTagList } from '../channelFacts';

export function ChannelAboutTab({ channel }: { channel: Channel }) {
  return (
    <PanelSection title="About" description={channel.description || undefined}>
      <ChannelFactGrid channel={channel} />
      {channel.tags.length > 0 ? (
        <div className="mt-4">
          <ChannelTagList tags={channel.tags} />
        </div>
      ) : null}
    </PanelSection>
  );
}
