import React from 'react';
import { BarChart3, Check, Clock, Loader2, Lock } from 'lucide-react';
import { usePoll } from '@/hooks/usePoll';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import type { PollView } from '@/api/types';

interface MessagePollContentProps {
  pollId: string;
  /** Shown while the poll itself is still loading. */
  question: string;
}

const visibilityHint = (poll: PollView): string | null => {
  if (poll.results_visible) return null;
  if (poll.results_visibility === 'after_vote') return 'Results are shown after you vote';
  if (poll.results_visibility === 'after_close') return 'Results are shown after the poll closes';
  return null;
};

const percentage = (count: number, total: number) =>
  total > 0 ? Math.round((count / total) * 100) : 0;

/**
 * A poll body, shell-agnostic. The chat lens wraps it in a bubble and the feed
 * wraps it in a post card; both drive it from a poll id, which is why the feed
 * projection only needs `poll_ref` rather than the whole poll.
 */
export const MessagePollContent: React.FC<MessagePollContentProps> = ({ pollId, question }) => {
  const currentUserId = useAuthStore((state) => state.userId);
  const { poll, isLoading, isError, vote, retract, close, isVoting, isClosing } = usePoll(pollId, {
    enabled: Boolean(pollId),
  });

  const shell = (children: React.ReactNode) => <>{children}</>;

  const header = (
    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-current/60">
      <BarChart3 className="h-3.5 w-3.5" />
      <span>PollBot</span>
    </div>
  );

  if (isLoading) {
    return shell(
      <>
        {header}
        <div className="flex items-center gap-2 text-sm text-current/70">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="truncate">{question}</span>
        </div>
      </>
    );
  }

  if (isError || !poll) {
    return shell(
      <>
        {header}
        <div className="text-sm font-semibold">{question}</div>
        <div className="mt-1 text-xs text-current/55">Poll unavailable</div>
      </>
    );
  }

  const total = poll.total_votes ?? 0;
  const canClose = !poll.closed && poll.created_by === currentUserId;
  const hasVoted = poll.my_option_ids.length > 0;
  const busy = isVoting || isClosing;
  const hint = visibilityHint(poll);

  const handleOptionClick = (optionId: string) => {
    if (poll.closed || busy) return;
    const selected = poll.my_option_ids.includes(optionId);
    if (poll.allows_multiple) {
      const next = selected
        ? poll.my_option_ids.filter((id) => id !== optionId)
        : [...poll.my_option_ids, optionId];
      if (next.length === 0) retract();
      else vote(next);
    } else if (!selected) {
      vote([optionId]);
    }
  };

  return shell(
    <>
      <div className="mb-1 flex items-center justify-between gap-2">
        {header}
        {poll.closed ? (
          <span className="flex items-center gap-1 text-xs text-current/55">
            <Lock className="h-3 w-3" />
            Closed
          </span>
        ) : poll.closes_at ? (
          <span className="flex items-center gap-1 text-xs text-current/55">
            <Clock className="h-3 w-3" />
            {new Date(poll.closes_at).toLocaleString()}
          </span>
        ) : null}
      </div>

      <div className="text-sm font-semibold">{poll.question}</div>
      {poll.created_by === currentUserId ? (
        <div className="mt-0.5 text-xs text-current/50">Created by you</div>
      ) : null}

      <div className="mt-3 space-y-2">
        {poll.options.map((option) => {
          const selected = poll.my_option_ids.includes(option.id);
          const count = option.vote_count ?? 0;
          const pct = poll.results_visible ? percentage(count, total) : 0;
          const interactive = !poll.closed && !busy;

          return (
            <button
              key={option.id}
              type="button"
              disabled={!interactive}
              onClick={() => handleOptionClick(option.id)}
              className={cn(
                'relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                selected ? 'border-primary' : 'border-current/15',
                interactive ? 'hover:border-primary/60' : 'cursor-default'
              )}
            >
              {poll.results_visible ? (
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-l-lg transition-[width]',
                    selected ? 'bg-primary/20' : 'bg-current/10'
                  )}
                  style={{ width: `${pct}%` }}
                />
              ) : null}
              <span className="relative flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
                  <span className="truncate">{option.text}</span>
                </span>
                {poll.results_visible ? (
                  <span className="shrink-0 text-xs tabular-nums text-current/60">{pct}%</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-current/55">
        <span>
          {poll.results_visible
            ? `${total} vote${total === 1 ? '' : 's'}`
            : hint ?? ''}
          {poll.allows_multiple ? ' · Multiple answers' : ''}
          {poll.anonymous ? ' · Anonymous' : ''}
        </span>
        <span className="flex items-center gap-2">
          {hasVoted && !poll.closed ? (
            <button
              type="button"
              onClick={() => retract()}
              disabled={busy}
              className="font-medium text-current/70 hover:text-current disabled:opacity-50"
            >
              Retract
            </button>
          ) : null}
          {canClose ? (
            <button
              type="button"
              onClick={() => close()}
              disabled={busy}
              className="font-medium text-current/70 hover:text-current disabled:opacity-50"
            >
              Close poll
            </button>
          ) : null}
        </span>
      </div>
    </>
  );
};
