import { cn } from '@/lib/utils';

export interface RuleOption<T extends string> {
  readonly value: T;
  /** Names the audience, not the policy value: "Members", not "members". */
  readonly label: string;
  /** A full sentence stating who this grants. Shown for the selected option. */
  readonly meaning: string;
}

interface SegmentedRuleProps<T extends string> {
  /** Phrased as the question a user is actually asking. */
  question: string;
  value: T;
  options: readonly RuleOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

/**
 * A permission rule stated in plain language. The segments name audiences and
 * the sentence underneath spells out what the current choice grants, so a
 * viewer never has to know the underlying policy vocabulary to answer the
 * question. The raw policy value is an input here, never a gate.
 */
export function SegmentedRule<T extends string>({
  question,
  value,
  options,
  onChange,
  disabled = false,
}: SegmentedRuleProps<T>) {
  const selected = options.find((option) => option.value === value);

  return (
    <div className={cn('py-3 first:pt-0 last:pb-0', disabled && 'opacity-60')}>
      <div role="group" aria-label={question} className="space-y-2">
        <p className="text-sm font-medium leading-none">{question}</p>

        <div className="flex flex-wrap gap-1.5 rounded-xl bg-muted/50 p-1">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isSelected}
                disabled={disabled}
                onClick={() => onChange(option.value)}
                className={cn(
                  'min-h-11 flex-1 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  isSelected
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                  disabled && 'cursor-not-allowed'
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {selected ? (
          <p className="text-sm text-muted-foreground">{selected.meaning}</p>
        ) : null}
      </div>
    </div>
  );
}
