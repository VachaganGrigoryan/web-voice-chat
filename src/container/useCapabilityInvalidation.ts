import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setForbiddenCallback } from '@/api/httpClient';
import { capabilityKeys } from '@/api/queryKeys';
import type { ResourceScopeType } from '@/api/types';
import { EVENTS } from '@/socket/events';
import { useSocketStore } from '@/socket/socket';

/**
 * Keeps cached capabilities honest. Mounted once, near the top of the app.
 *
 * Three paths, because no one of them is sufficient:
 *
 *  1. `capabilities.invalidated` — the server tells us a role or policy changed.
 *     Without it a promotion waits out the five-minute stale time, so a new
 *     moderator keeps seeing a read-only UI.
 *  2. Relationship and block events — joining, leaving, or being blocked
 *     changes what the viewer may do, and those events already exist.
 *  3. A 403 on a container-scoped request — the last line of defence, for
 *     anything the first two miss. Bounds how long a wrong UI can persist.
 *
 * Mutations invalidate directly at their call sites; that is the fourth path and
 * does not belong here.
 */
export function useCapabilityInvalidation(): void {
  const queryClient = useQueryClient();
  const socket = useSocketStore((state) => state.socket);

  useEffect(() => {
    const invalidate = (scope: string, id: string) => {
      void queryClient.invalidateQueries({
        queryKey: capabilityKeys.resource(scope as ResourceScopeType, id),
      });
      queryClient.removeQueries({
        queryKey: capabilityKeys.resource(scope as ResourceScopeType, id),
      });
    };

    setForbiddenCallback(invalidate);
    return () => setForbiddenCallback(() => undefined);
  }, [queryClient]);

  useEffect(() => {
    if (!socket) return;

    const handleInvalidated = (payload: {
      resource?: { type?: string; id?: string };
    }) => {
      const resource = payload?.resource;
      if (!resource?.type || !resource?.id) return;
      queryClient.removeQueries({
        queryKey: capabilityKeys.resource(resource.type as ResourceScopeType, resource.id),
      });
    };

    // A relationship or block change can alter standing on any resource, and the
    // payload does not say which, so the whole group goes.
    const handleRelationshipChange = () => {
      queryClient.removeQueries({ queryKey: capabilityKeys.all });
    };

    socket.on(EVENTS.CAPABILITIES_INVALIDATED, handleInvalidated);
    socket.on(EVENTS.RELATIONSHIP_ACTIVATED, handleRelationshipChange);
    socket.on(EVENTS.RELATIONSHIP_REVOKED, handleRelationshipChange);
    socket.on(EVENTS.BLOCK_CREATED, handleRelationshipChange);
    socket.on(EVENTS.BLOCK_REMOVED, handleRelationshipChange);

    return () => {
      socket.off(EVENTS.CAPABILITIES_INVALIDATED, handleInvalidated);
      socket.off(EVENTS.RELATIONSHIP_ACTIVATED, handleRelationshipChange);
      socket.off(EVENTS.RELATIONSHIP_REVOKED, handleRelationshipChange);
      socket.off(EVENTS.BLOCK_CREATED, handleRelationshipChange);
      socket.off(EVENTS.BLOCK_REMOVED, handleRelationshipChange);
    };
  }, [socket, queryClient]);
}

/** For mutation call sites that know exactly which resource they changed. */
export const invalidateResourceCapabilities = (
  queryClient: ReturnType<typeof useQueryClient>,
  scope: ResourceScopeType,
  id: string
): void => {
  queryClient.removeQueries({ queryKey: capabilityKeys.resource(scope, id) });
};
