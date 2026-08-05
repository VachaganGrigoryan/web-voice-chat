/**
 * Which actions a container header offers, as data.
 *
 * This used to be `if (isChannel) return []` followed by a second, hand-written
 * channel menu — which is why a channel had no mute, pin or archive in its
 * header even though the API supports all three, and why its "settings" item
 * navigated to the channel page instead.
 *
 * Every entry is gated on something the descriptor already knows: a capability,
 * or the presence of the conversation-only affordance group. An action the
 * viewer cannot take is left out of the list rather than returned disabled,
 * which is the rule the `web-unified-client` spec states for affordances.
 *
 * Pure and React-free so the resulting set per container kind is asserted in
 * tests rather than eyeballed in the browser.
 */

export type HeaderActionId =
  | 'audio_call'
  | 'video_call'
  | 'search'
  | 'saved'
  | 'scheduled'
  | 'notifications'
  | 'chat_pin'
  | 'folder'
  | 'archive'
  | 'send_ping'
  | 'settings';

export type HeaderContainerKind = 'dm' | 'group' | 'channel';

export interface HeaderActionInput {
  readonly kind: HeaderContainerKind;
  /** Absent for channels; its presence is what gates drafts, folders and pins. */
  readonly hasConversationOnly: boolean;
  readonly canStartCall: boolean;
  /** A DM only offers calls once the ping handshake is accepted. */
  readonly isPingAccepted: boolean;
  readonly canPing: boolean;
  /** The host supplies a search handler only where search is wired up. */
  readonly canSearch: boolean;
}

/** In display order. The header takes the first few as quick actions. */
export const HEADER_ACTION_IDS: readonly HeaderActionId[] = [
  'audio_call',
  'video_call',
  'search',
  'saved',
  'scheduled',
  'notifications',
  'chat_pin',
  'folder',
  'archive',
  'send_ping',
  'settings',
];

const isAllowed = (id: HeaderActionId, input: HeaderActionInput): boolean => {
  const isDm = input.kind === 'dm';

  switch (id) {
    case 'audio_call':
    case 'video_call':
      // Calls are a DM affordance and only after the ping handshake.
      return isDm && input.isPingAccepted && input.canStartCall;

    case 'search':
      return input.canSearch;

    // Saved and scheduled messages are addressed per conversation today.
    case 'saved':
    case 'scheduled':
    case 'folder':
      return input.hasConversationOnly;

    // Both container kinds carry per-viewer inbox and notification state.
    case 'notifications':
    case 'chat_pin':
    case 'archive':
      return true;

    case 'send_ping':
      return isDm && input.canPing && !input.isPingAccepted;

    // Every container has settings; the sections inside are resolved separately.
    case 'settings':
      return true;

    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
};

export const buildHeaderActionIds = (
  input: HeaderActionInput
): readonly HeaderActionId[] => HEADER_ACTION_IDS.filter((id) => isAllowed(id, input));
