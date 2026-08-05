/**
 * Which quick actions a container summary offers, as data.
 *
 * The third module of this shape, after `headerActions.ts` and
 * `inboxMenuItems.ts`. Keeping the decision out of the component is what makes
 * "absent, never disabled" a property the tests can check rather than a claim
 * in a comment.
 */

export type InfoActionId =
  | 'open_surface'
  | 'settings'
  | 'follow'
  | 'block'
  | 'leave';

export type InfoContainerKind = 'dm' | 'group' | 'channel';

export interface InfoActionInput {
  readonly kind: InfoContainerKind;
  readonly canManage: boolean;
  /**
   * Whether a full surface exists to open. A group has no page of its own
   * beyond the chat, so it has nothing to open.
   */
  readonly hasSurface: boolean;
  /** The peer of a DM; absent when the conversation has no resolvable peer. */
  readonly hasPeer: boolean;
}

/** In display order. */
export const INFO_ACTION_IDS: readonly InfoActionId[] = [
  'open_surface',
  'settings',
  'follow',
  'block',
  'leave',
];

const isAllowed = (id: InfoActionId, input: InfoActionInput): boolean => {
  switch (id) {
    case 'open_surface':
      return input.hasSurface;

    case 'settings':
      return input.canManage;

    // Following applies to a person or a channel; a group is joined, not followed.
    case 'follow':
      return input.kind === 'channel' || (input.kind === 'dm' && input.hasPeer);

    case 'block':
      return input.kind === 'dm' && input.hasPeer;

    // A DM is deleted rather than left; that lives in settings, not here.
    case 'leave':
      return input.kind === 'group' || input.kind === 'channel';

    default: {
      const exhaustive: never = id;
      return exhaustive;
    }
  }
};

export const buildInfoActionIds = (input: InfoActionInput): readonly InfoActionId[] =>
  INFO_ACTION_IDS.filter((id) => isAllowed(id, input));
