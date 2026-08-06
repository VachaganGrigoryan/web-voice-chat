import { useMemo, useState } from 'react';
import { Loader2, Plus, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import type { PollOptionInput, PollResultsVisibility } from '@/api/types';

export interface PollComposerValues {
  question: string;
  options: PollOptionInput[];
  allows_multiple: boolean;
  anonymous: boolean;
  results_visibility: PollResultsVisibility;
  closes_at: string | null;
}

interface PollBotComposerProps {
  isSending: boolean;
  onSubmit: (poll: PollComposerValues) => Promise<void>;
  onCancel: () => void;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

const VISIBILITY_OPTIONS: ReadonlyArray<{ value: PollResultsVisibility; label: string }> = [
  { value: 'after_vote', label: 'After voting' },
  { value: 'always', label: 'Always visible' },
  { value: 'after_close', label: 'After poll closes' },
];

const normalizeOption = (value: string) => value.trim();

export function PollBotComposer({ isSending, onSubmit, onCancel }: PollBotComposerProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [allowsMultiple, setAllowsMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [resultsVisibility, setResultsVisibility] = useState<PollResultsVisibility>('after_vote');
  const [closesAt, setClosesAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const busy = isSending || submitting;

  const validOptions = useMemo(
    () => options.map(normalizeOption).filter(Boolean),
    [options]
  );
  const canAddOption = options.length < MAX_OPTIONS;
  const canRemoveOption = options.length > MIN_OPTIONS;

  const updateOption = (index: number, value: string) => {
    setOptions((current) =>
      current.map((option, optionIndex) => (optionIndex === index ? value : option))
    );
  };

  const removeOption = (index: number) => {
    if (!canRemoveOption) return;
    setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index));
  };

  const handleSubmit = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setError('Add a question before sending.');
      return;
    }
    if (validOptions.length < MIN_OPTIONS) {
      setError('Add at least two options.');
      return;
    }

    let closesAtIso: string | null = null;
    if (closesAt) {
      const parsed = new Date(closesAt);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        setError('Deadline must be in the future.');
        return;
      }
      closesAtIso = parsed.toISOString();
    }

    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        question: trimmedQuestion,
        options: validOptions.map((option, index) => ({
          id: `option-${index + 1}`,
          text: option,
        })),
        allows_multiple: allowsMultiple,
        anonymous,
        results_visibility: resultsVisibility,
        closes_at: closesAtIso,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="poll-question" className="mb-1 block text-xs font-medium text-muted-foreground">
          Question
        </label>
        <Input
          id="poll-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question"
          maxLength={500}
          disabled={busy}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">Options</span>
          <span className="text-xs text-muted-foreground">
            {validOptions.length}/{MAX_OPTIONS}
          </span>
        </div>
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={option}
              onChange={(event) => updateOption(index, event.target.value)}
              placeholder={`Option ${index + 1}`}
              maxLength={200}
              disabled={busy}
              aria-label={`Poll option ${index + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                'h-10 w-10 shrink-0 rounded-full text-muted-foreground',
                canRemoveOption && 'hover:text-destructive'
              )}
              onClick={() => removeOption(index)}
              disabled={busy || !canRemoveOption}
              aria-label={`Remove option ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-full"
          onClick={() => setOptions((current) => [...current, ''])}
          disabled={busy || !canAddOption}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add option
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-border/70 px-3 py-2 text-sm transition-colors hover:bg-muted/60">
          <input
            type="checkbox"
            checked={allowsMultiple}
            onChange={(event) => setAllowsMultiple(event.target.checked)}
            disabled={busy}
            className="h-4 w-4 accent-primary"
          />
          Multiple answers
        </label>
        <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-border/70 px-3 py-2 text-sm transition-colors hover:bg-muted/60">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(event) => setAnonymous(event.target.checked)}
            disabled={busy}
            className="h-4 w-4 accent-primary"
          />
          Anonymous
        </label>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor="poll-visibility" className="mb-1 block text-xs font-medium text-muted-foreground">
            Show results
          </label>
          <select
            id="poll-visibility"
            value={resultsVisibility}
            onChange={(event) => setResultsVisibility(event.target.value as PollResultsVisibility)}
            disabled={busy}
            className="h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm"
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="poll-deadline" className="mb-1 block text-xs font-medium text-muted-foreground">
            Closes at (optional)
          </label>
          <Input
            id="poll-deadline"
            type="datetime-local"
            value={closesAt}
            onChange={(event) => setClosesAt(event.target.value)}
            disabled={busy}
          />
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" className="rounded-full" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" className="rounded-full" onClick={() => void handleSubmit()} disabled={busy}>
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Send poll
        </Button>
      </div>
    </div>
  );
}
