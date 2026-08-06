import { describe, expect, it } from 'vitest';
import type { ConnectionListItem } from '@/api/types';
import { getConnectionActionTargets } from './connectionActionTargets';

const connectionItem = (): ConnectionListItem =>
  ({
    relationship: {
      id: 'relationship-123',
      status: 'pending',
      updated_at: '2026-08-06T08:00:00.000Z',
    },
    peer: {
      id: 'peer-456',
    },
  }) as ConnectionListItem;

describe('connection action targets', () => {
  it('separates lifecycle relationship ids from peer user ids', () => {
    expect(getConnectionActionTargets(connectionItem())).toEqual({
      relationshipId: 'relationship-123',
      peerUserId: 'peer-456',
    });
  });
});
