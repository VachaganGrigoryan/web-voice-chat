import React from 'react';
import { formatMessageDay, isSameLocalDay } from '@/utils/dateUtils';
import { MediaCollageGroupRenderer } from '../renderers/MediaCollageGroupRenderer';
import {
  ChatRenderItem,
  shouldGroupMessages,
} from '../utils/mediaGroupUtils';
import { ChatMessage, MediaClickPayload } from '../types/message';
import { MessageRenderer } from '../MessageRenderer';
import { ChatAudioQueueItem } from '../media/players/audioPlayerStore';
import {
  DaySeparator,
  MessageBubbleFooter,
  MessageItem,
  MessageMenuAnchor,
  MessageMeta,
} from './MessageShell';
import { MessageReactions } from './MessageReactions';
import { cn } from '@/lib/utils';

interface ChatTimelineItemsProps {
  renderItems: ChatRenderItem[];
  chronology: 'newest-first' | 'oldest-first';
  currentUserId?: string | null;
  highlightedMessageIds?: Set<string>;
  onOpenMenu: (message: ChatMessage, anchor: MessageMenuAnchor) => void;
  onToggleReaction: (messageId: string, emoji: string) => Promise<void>;
  isTogglingReaction?: boolean;
  onMediaClick?: (payload: MediaClickPayload) => void;
  audioQueueKey?: string | null;
  audioQueue?: ChatAudioQueueItem[];
  isMessageMenuOpen?: boolean;
  registerMessageElement?: (messageIds: string[], node: HTMLDivElement | null) => void;
  getBubbleFooter?: (message: ChatMessage) => React.ReactNode;
  standaloneSystemMessages?: boolean;
}

export function ChatTimelineItems({
  renderItems,
  chronology,
  currentUserId,
  highlightedMessageIds = new Set(),
  onOpenMenu,
  onToggleReaction,
  isTogglingReaction = false,
  onMediaClick,
  audioQueueKey,
  audioQueue,
  isMessageMenuOpen = false,
  registerMessageElement,
  getBubbleFooter,
  standaloneSystemMessages = false,
}: ChatTimelineItemsProps) {
  return (
    <>
      {renderItems.map((item, index) => {
        const previousItem = renderItems[index - 1];
        const nextItem = renderItems[index + 1];
        const olderItem = chronology === 'newest-first' ? nextItem : previousItem;
        const newerItem = chronology === 'newest-first' ? previousItem : nextItem;

        const showDaySeparator =
          chronology === 'newest-first'
            ? !olderItem ||
              !isSameLocalDay(item.lastMessage.createdAt, olderItem.firstMessage.createdAt)
            : !previousItem ||
              !isSameLocalDay(item.firstMessage.createdAt, previousItem.lastMessage.createdAt);

        const groupedWithAbove =
          chronology === 'newest-first'
            ? shouldGroupMessages(item.lastMessage, olderItem?.firstMessage)
            : shouldGroupMessages(item.firstMessage, previousItem?.lastMessage);

        const groupedWithBelow =
          chronology === 'newest-first'
            ? shouldGroupMessages(item.firstMessage, newerItem?.lastMessage)
            : shouldGroupMessages(item.lastMessage, nextItem?.firstMessage);

        const isHighlighted = item.messages.some((message) =>
          highlightedMessageIds.has(message.id)
        );

        const messageNodeRef = registerMessageElement
          ? (node: HTMLDivElement | null) =>
              registerMessageElement(
                item.messages.map((message) => message.id),
                node
              )
          : undefined;
        const bubbleFooterContent =
          item.type === 'single' ? getBubbleFooter?.(item.message) : undefined;

        return (
          <div
            key={item.id}
            ref={messageNodeRef}
            className={cn(
              'flex flex-col w-full min-w-0',
              groupedWithAbove
                ? 'mt-px'
                : chronology === 'newest-first'
                ? index === renderItems.length - 1
                  ? ''
                  : 'mt-6'
                : index === 0
                ? ''
                : 'mt-6'
            )}
          >
            {showDaySeparator ? (
              <DaySeparator
                label={formatMessageDay(
                  chronology === 'newest-first'
                    ? item.lastMessage.createdAt
                    : item.firstMessage.createdAt
                )}
                className={chronology === 'newest-first' ? 'mb-3' : 'pb-3'}
              />
            ) : null}

            {standaloneSystemMessages &&
            item.type === 'single' &&
            item.message.kind === 'system' ? (
              <MessageRenderer
                message={item.message}
                highlighted={isHighlighted}
                onMediaClick={onMediaClick}
              />
            ) : item.type === 'media-group' ? (
              <MessageItem
                isOwn={item.isOwn}
                onOpenMenu={(anchor) => onOpenMenu(item.latestMessage, anchor)}
                openMenuOnClick={isMessageMenuOpen}
              >
                <MediaCollageGroupRenderer
                  messages={item.messages}
                  caption={item.caption}
                  highlighted={isHighlighted}
                  groupedWithAbove={groupedWithAbove}
                  groupedWithBelow={groupedWithBelow}
                  onMediaClick={onMediaClick}
                />
                <MessageMeta message={item.latestMessage} showTimestamp={!groupedWithBelow} />
              </MessageItem>
            ) : (
              <MessageItem
                isOwn={item.message.isOwn}
                onOpenMenu={(anchor) => onOpenMenu(item.message, anchor)}
                openMenuOnClick={isMessageMenuOpen}
              >
                <MessageRenderer
                  message={item.message}
                  highlighted={isHighlighted}
                  groupedWithAbove={groupedWithAbove}
                  groupedWithBelow={groupedWithBelow}
                  onMediaClick={onMediaClick}
                  audioQueueKey={audioQueueKey}
                  audioQueue={audioQueue}
                  bubbleFooter={
                    bubbleFooterContent ? (
                      <MessageBubbleFooter>
                        {bubbleFooterContent}
                      </MessageBubbleFooter>
                    ) : undefined
                  }
                />
                <MessageReactions
                  message={item.message}
                  currentUserId={currentUserId}
                  isBusy={isTogglingReaction}
                  onToggleReaction={(emoji) => onToggleReaction(item.message.id, emoji)}
                />
                <MessageMeta message={item.message} showTimestamp={!groupedWithBelow} />
              </MessageItem>
            )}
          </div>
        );
      })}
    </>
  );
}
