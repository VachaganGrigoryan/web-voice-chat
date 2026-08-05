import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, X } from 'lucide-react';

import { messagesApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import { resolveMessageContent } from '@/api/messageContent';
import type { ChannelInboxRow, Conversation, MessageDoc } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useDebounce } from '@/hooks/useDebounce';
import { formatMessageDateTime } from '@/utils/dateUtils';
import { cn } from '@/lib/utils';
import { getConversationLabel } from './inboxPreview';

const MIN_QUERY_LENGTH = 2;
const PAGE_SIZE = 12;

interface ChatSidebarMessageSearchProps {
  readonly conversations: readonly Conversation[];
  readonly channelRows: readonly ChannelInboxRow[];
  readonly onSelectMessage: (message: MessageDoc) => void;
}

function previewText(message: MessageDoc): string {
  const resolved = resolveMessageContent(message);
  if (resolved.isEncrypted) return 'Encrypted message';
  if (resolved.text?.trim()) return resolved.text.trim();
  if (resolved.media) return `${resolved.media.kind} attachment`;
  return 'Message';
}

function containerLabel(
  message: MessageDoc,
  conversations: readonly Conversation[],
  channelRows: readonly ChannelInboxRow[]
): string {
  if (message.container_type === 'channel') {
    return (
      channelRows.find((row) => row.channel.id === message.container_id)?.channel.name ??
      'Channel'
    );
  }

  const conversation = conversations.find(
    (item) =>
      item.id === message.container_id ||
      item.conversation_id === message.container_id
  );
  return conversation ? getConversationLabel(conversation) : 'Conversation';
}

export function ChatSidebarMessageSearch({
  conversations,
  channelRows,
  onSelectMessage,
}: ChatSidebarMessageSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const trimmedQuery = query.trim();
  const debouncedQuery = useDebounce(trimmedQuery, 350);
  const searchEnabled = debouncedQuery.length >= MIN_QUERY_LENGTH;

  const searchQuery = useQuery({
    queryKey: ['chat-sidebar-message-search', debouncedQuery],
    queryFn: () => messagesApi.searchMessages(debouncedQuery, { limit: PAGE_SIZE }),
    enabled: searchEnabled,
  });

  const results = searchQuery.data?.data ?? [];
  const error = searchQuery.error
    ? extractApiError(searchQuery.error, 'Search failed')
    : null;

  const isShortQuery = trimmedQuery.length > 0 && trimmedQuery.length < MIN_QUERY_LENGTH;
  const hasQuery = trimmedQuery.length > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!hasQuery) {
      setIsOpen(false);
    }
  }, [hasQuery]);

  const body = useMemo(() => {
    if (!hasQuery) return null;
    if (isShortQuery) {
      return (
        <div className="px-3 py-6 text-center text-sm text-muted-foreground">
          Type at least {MIN_QUERY_LENGTH} characters
        </div>
      );
    }
    if (searchQuery.isLoading || searchQuery.isFetching) {
      return (
        <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching
        </div>
      );
    }
    if (error) {
      return <div className="px-3 py-6 text-center text-sm text-destructive">{error}</div>;
    }
    if (results.length === 0) {
      return (
        <div className="px-3 py-6 text-center text-sm text-muted-foreground">
          No messages found
        </div>
      );
    }

    return (
      <ul className="p-1">
        {results.map((message) => (
          <li key={message.id}>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onSelectMessage(message);
              }}
              className={cn(
                'flex w-full cursor-pointer flex-col gap-1 rounded-lg px-3 py-2 text-left transition-colors',
                'hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              <span className="line-clamp-2 text-sm text-foreground">
                {previewText(message)}
              </span>
              <span className="flex min-w-0 items-center gap-2 text-2xs text-muted-foreground">
                <span className="truncate">
                  {containerLabel(message, conversations, channelRows)}
                </span>
                <span aria-hidden="true">-</span>
                <span className="shrink-0">
                  {formatMessageDateTime(message.created_at) || ''}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }, [
    channelRows,
    conversations,
    error,
    hasQuery,
    isShortQuery,
    onSelectMessage,
    results,
    searchQuery.isFetching,
    searchQuery.isLoading,
  ]);

  return (
    <div ref={wrapperRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (hasQuery) setIsOpen(true);
        }}
        placeholder="Search your messages"
        className="h-10 pl-9 pr-9"
      />
      {query ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Clear message search"
          onClick={() => {
            setQuery('');
            setIsOpen(false);
          }}
          className="absolute right-1 top-1 h-8 w-8 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}

      {isOpen && body ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[360px] overflow-y-auto rounded-xl border bg-popover shadow-e3">
          {body}
        </div>
      ) : null}
    </div>
  );
}
