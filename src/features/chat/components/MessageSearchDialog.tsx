import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import { messagesApi } from '@/api/endpoints';
import { resolveMessageContent } from '@/api/messageContent';
import type { MessageDoc } from '@/api/types';
import { extractApiError } from '@/api/errors';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { formatMessageDateTime } from '@/utils/dateUtils';

interface MessageSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Jump to a hit; the caller navigates to the conversation/message. */
  onSelectResult?: (message: MessageDoc) => void;
}

const PAGE_SIZE = 20;

function previewText(message: MessageDoc): string {
  const resolved = resolveMessageContent(message);
  if (resolved.isEncrypted) return 'Encrypted message';
  if (resolved.text && resolved.text.trim()) return resolved.text.trim();
  if (resolved.media) return `${resolved.media.kind} attachment`;
  return 'Message';
}

export function MessageSearchDialog({
  open,
  onOpenChange,
  onSelectResult,
}: MessageSearchDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MessageDoc[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const trimmed = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setPage(1);
      setHasMore(false);
      setError(null);
      setSearched(false);
    }
  }, [open]);

  const runSearch = async (nextPage: number) => {
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const data = await messagesApi.searchMessages(trimmed, {
        limit: PAGE_SIZE,
        page: nextPage,
      });
      setResults((prev) => (nextPage === 1 ? data.items : [...prev, ...data.items]));
      setHasMore(data.has_more);
      setPage(nextPage);
      setSearched(true);
    } catch (err) {
      setError(extractApiError(err, 'Search failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-lg flex-col rounded-2xl p-5">
        <DialogHeader>
          <DialogTitle>Search messages</DialogTitle>
          <DialogDescription>
            Search across all your conversations.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void runSearch(1);
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for a word or phrase"
              className="pl-9"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={!trimmed || loading}>
            {loading && page === 1 ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
          </Button>
        </form>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
          {searched && results.length === 0 && !loading && !error ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No messages found.
            </p>
          ) : null}

          <ul className="space-y-1">
            {results.map((message) => (
              <li key={message.id}>
                <button
                  type="button"
                  disabled={!onSelectResult}
                  onClick={() => onSelectResult?.(message)}
                  className="w-full rounded-xl px-3 py-2 text-left transition-colors hover:bg-muted/70 disabled:cursor-default"
                >
                  <div className="truncate text-sm text-foreground">
                    {previewText(message)}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {formatMessageDateTime(message.created_at) || ''}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {hasMore ? (
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={() => void runSearch(page + 1)}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load more'}
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
