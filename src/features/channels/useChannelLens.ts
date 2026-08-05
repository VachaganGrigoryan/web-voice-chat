import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { channelLensFromPath, channelLensRoute } from '@/app/routes';
import type { ChannelLens } from '@/app/routes';

export type { ChannelLens };
export { DEFAULT_CHANNEL_LENS } from '@/app/routes';

/**
 * A channel is one stream of messages that reads two ways: a dense chat
 * timeline (Slack/Telegram) or a feed of post cards (Facebook).
 *
 * The lens is carried by the route, not by a stored preference. It used to be
 * a `localStorage` map, which meant the same URL rendered differently for two
 * readers and a channel could not be linked in a specific lens. Switching now
 * navigates, and both lens routes sit inside the chat shell so the reader
 * keeps their inbox either way.
 */
export function useChannelLens(channelId: string | null, spaceId?: string | null) {
  const location = useLocation();
  const navigate = useNavigate();

  const lens = channelLensFromPath(location.pathname);

  const setLens = useCallback(
    (next: ChannelLens) => {
      if (!channelId || next === lens) return;
      navigate(channelLensRoute(spaceId ?? null, channelId, next));
    },
    [channelId, spaceId, lens, navigate]
  );

  return { lens, setLens };
}
