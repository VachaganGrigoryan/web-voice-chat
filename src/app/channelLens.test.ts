import { describe, expect, it } from 'vitest';
import { APP_ROUTES, channelLensFromPath, channelLensRoute } from './routes';

describe('channel lens routing', () => {
  it('reads the feed lens off a space-scoped path', () => {
    expect(channelLensFromPath('/spaces/s1/channels/c1/feed')).toBe('feed');
    expect(channelLensFromPath('/spaces/s1/channels/c1/chat')).toBe('chat');
  });

  it('reads the feed lens off a spaceless path', () => {
    expect(channelLensFromPath('/chat/channels/c1/feed')).toBe('feed');
    expect(channelLensFromPath('/chat/channels/c1')).toBe('chat');
  });

  it('defaults to the chat lens for any other path', () => {
    expect(channelLensFromPath('/chat/channels/c1/thread/m1')).toBe('chat');
    expect(channelLensFromPath('/dms/d1')).toBe('chat');
  });

  it('does not mistake a channel id containing "feed" for the feed lens', () => {
    expect(channelLensFromPath('/chat/channels/feedback')).toBe('chat');
    expect(channelLensFromPath('/spaces/s1/channels/newsfeed/chat')).toBe('chat');
  });

  it('builds an addressable route for both lenses, space-scoped or not', () => {
    expect(channelLensRoute('s1', 'c1', 'chat')).toBe(APP_ROUTES.spaceChannel('s1', 'c1', 'chat'));
    expect(channelLensRoute('s1', 'c1', 'feed')).toBe(APP_ROUTES.spaceChannel('s1', 'c1', 'feed'));
    expect(channelLensRoute(null, 'c1', 'chat')).toBe(APP_ROUTES.chatChannel('c1'));
    expect(channelLensRoute(null, 'c1', 'feed')).toBe(APP_ROUTES.chatChannelFeed('c1'));
  });

  it('round-trips every lens through its own route', () => {
    for (const spaceId of ['s1', null]) {
      for (const lens of ['chat', 'feed'] as const) {
        expect(channelLensFromPath(channelLensRoute(spaceId, 'c1', lens))).toBe(lens);
      }
    }
  });
});
