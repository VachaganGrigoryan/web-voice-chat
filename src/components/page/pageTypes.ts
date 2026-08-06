import { type ComponentType } from 'react';

export type PageIcon = ComponentType<{ className?: string }>;

export interface PageAction {
  readonly id: string;
  readonly label: string;
  readonly icon: PageIcon;
  readonly onSelect: () => void;
  readonly disabled?: boolean;
  readonly destructive?: boolean;
}

/**
 * Caps inline secondary actions at two. Combined with a single `primaryAction`
 * this holds every page to at most three visible controls — a fourth is a type
 * error, not a review comment, and belongs in `overflowActions`.
 */
export type SecondaryActions = readonly [PageAction] | readonly [PageAction, PageAction];

export interface PageTab {
  readonly id: string;
  readonly label: string;
  readonly icon?: PageIcon;
  /** Badge count; falsy values render nothing. */
  readonly count?: number;
  readonly description?: string;
}
