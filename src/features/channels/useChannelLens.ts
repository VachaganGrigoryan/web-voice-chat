import { useCallback, useState } from 'react';

/**
 * A channel is one stream of messages that reads two ways: a dense chat timeline
 * (Slack/Telegram) or a feed of post cards (Facebook). The lens is a reader
 * preference, not a property of the channel or the route.
 */
export type ChannelLens = 'chat' | 'feed';

const STORAGE_KEY = 'voca:channel-lens';

type LensMap = Record<string, ChannelLens>;

const readLenses = (): LensMap => {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        ([, value]) => value === 'chat' || value === 'feed'
      )
    ) as LensMap;
  } catch {
    return {};
  }
};

/** The lens a channel opens with when the reader has expressed no preference. */
export const DEFAULT_CHANNEL_LENS: ChannelLens = 'chat';

export function useChannelLens(channelId: string | null) {
  const [lenses, setLenses] = useState<LensMap>(readLenses);

  const lens: ChannelLens =
    (channelId ? lenses[channelId] : undefined) ?? DEFAULT_CHANNEL_LENS;

  const setLens = useCallback(
    (next: ChannelLens) => {
      if (!channelId) return;

      setLenses((current) => {
        const updated = { ...current, [channelId]: next };
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        }
        return updated;
      });
    },
    [channelId]
  );

  return { lens, setLens };
}
