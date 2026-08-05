/**
 * Which items an inbox row's context menu offers, as data.
 *
 * The menu used to fork into a conversation branch and a channel branch, each
 * hand-maintained. That is why a conversation had no notification control and
 * no leave in its row menu, and a channel had no archive even though
 * `channelsApi.setInboxState` accepts one. Both lists are now derived from the
 * same gates.
 *
 * Pure and React-free so the resulting set per row kind is asserted in tests.
 */

export type InboxMenuItemId =
  | 'pin'
  | 'archive'
  | 'folder'
  | 'notifications'
  | 'mark_read'
  | 'clear'
  | 'leave'
  | 'delete';

export type InboxRowKind = 'dm' | 'group' | 'channel';

export interface InboxMenuInput {
  readonly kind: InboxRowKind;
  /**
   * Absent for channels. Folders, clearing and deleting are addressed through
   * conversation endpoints that have no channel equivalent.
   */
  readonly hasConversationOnly: boolean;
}

/** In display order; `separatorsAfter` marks where the menu draws a rule. */
export const INBOX_MENU_ITEM_IDS: readonly InboxMenuItemId[] = [
  'pin',
  'archive',
  'folder',
  'notifications',
  'mark_read',
  'clear',
  'leave',
  'delete',
];

export const INBOX_MENU_SEPARATORS_AFTER: ReadonlySet<InboxMenuItemId> = new Set<InboxMenuItemId>([
  'notifications',
  'mark_read',
]);

const isAllowed = (id: InboxMenuItemId, input: InboxMenuInput): boolean => {
  switch (id) {
    // Per-viewer inbox and notification state exists for both container kinds.
    case 'pin':
    case 'archive':
    case 'notifications':
    case 'mark_read':
      return true;

    case 'folder':
    case 'clear':
      return input.hasConversationOnly;

    // A DM is left by deleting it, not by leaving it.
    case 'leave':
      return input.kind !== 'dm';

    case 'delete':
      return input.hasConversationOnly;

    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
};

export const buildInboxMenuItemIds = (
  input: InboxMenuInput
): readonly InboxMenuItemId[] => INBOX_MENU_ITEM_IDS.filter((id) => isAllowed(id, input));
