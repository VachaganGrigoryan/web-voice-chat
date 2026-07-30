import { APP_ROUTES, ChatView } from '@/app/routes';
import type { Conversation } from '@/api/types';

export type ThreadPanelMode = 'minimal' | 'center' | 'full';

/** Most-recent-first, matching the order the old inline chat inbox derived. */
export function sortConversationsByRecency(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((left, right) => {
    const leftTime = new Date(left.last_message_at || 0).getTime();
    const rightTime = new Date(right.last_message_at || 0).getTime();
    return rightTime - leftTime;
  });
}

export const MOBILE_BREAKPOINT = 768;
export const THREAD_PANEL_MODES: ThreadPanelMode[] = ['minimal', 'center', 'full'];

export function chatViewToPath(view: ChatView): string {
  return APP_ROUTES.chat;
}

export function pathToChatView(pathname: string): ChatView {
  return 'chats';
}

export function getThreadPanelWidths(containerWidth: number): Record<ThreadPanelMode, number> {
  const safeWidth = Math.max(containerWidth, 720);
  const minMainWidth = 360;
  const maxThreadWidth = Math.max(320, safeWidth - minMainWidth);
  const preferredWidths: Record<ThreadPanelMode, number> = {
    minimal: Math.round(safeWidth * 0.32),
    center: Math.round(safeWidth * 0.4),
    full: Math.round(safeWidth * 0.48),
  };

  return THREAD_PANEL_MODES.reduce(
    (widths, mode) => ({
      ...widths,
      [mode]: Math.min(maxThreadWidth, Math.max(320, preferredWidths[mode])),
    }),
    {} as Record<ThreadPanelMode, number>
  );
}
