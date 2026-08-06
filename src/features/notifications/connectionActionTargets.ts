import type { ConnectionListItem } from '@/api/types';

export interface ConnectionActionTargets {
  readonly relationshipId: string;
  readonly peerUserId: string;
}

export function getConnectionActionTargets(item: ConnectionListItem): ConnectionActionTargets {
  return {
    relationshipId: item.relationship.id,
    peerUserId: item.peer.id,
  };
}
