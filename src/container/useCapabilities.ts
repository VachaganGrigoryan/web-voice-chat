import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { capabilitiesApi } from '@/api/endpoints';
import { capabilityKeys } from '@/api/queryKeys';
import type {
  MessageContainerRef,
  ResourceCapabilitiesView,
  ResourceRef,
  ResourceScopeType,
  ViewerBlock,
} from '@/api/types';

/**
 * Capabilities are fetched in batches but cached per resource.
 *
 * Both halves matter. Batching is a server constraint: one authorization
 * context is built per request and memoizes inside it, so fifty resources
 * resolved together share those lookups. Per-resource keys are a client
 * concern: a feed card and a chat header asking about the same channel must
 * share one entry rather than each holding a slice of a different batch.
 */

const STALE_TIME = 5 * 60 * 1000;
const GC_TIME = 30 * 60 * 1000;

const keyOf = (ref: ResourceRef) => `${ref.type}:${ref.id}`;

const read = (
  queryClient: ReturnType<typeof useQueryClient>,
  ref: ResourceRef
): ResourceCapabilitiesView | undefined =>
  queryClient.getQueryData<ResourceCapabilitiesView>(
    capabilityKeys.resource(ref.type, ref.id)
  );

const write = (
  queryClient: ReturnType<typeof useQueryClient>,
  view: ResourceCapabilitiesView
): void => {
  queryClient.setQueryData(
    capabilityKeys.resource(view.resource.type, view.resource.id),
    view
  );
};

/**
 * Seed a resource's entry from the `viewer` block that came back with the
 * resource itself, so a cold deep link paints before any capability request
 * completes. Marked as a partial: `allowed` carries only what the block can
 * prove, and `denied` stays empty because the block cannot distinguish
 * "refused" from "not evaluated".
 */
export const seedFromViewerBlock = (
  queryClient: ReturnType<typeof useQueryClient>,
  ref: ResourceRef,
  viewer: ViewerBlock | null | undefined
): void => {
  if (!viewer) return;
  if (read(queryClient, ref)) return;

  const allowed: string[] = [];
  if (viewer.can_post) allowed.push('message.create');
  if (viewer.can_comment) allowed.push('thread.reply');
  if (viewer.can_manage) allowed.push('resource.manage');

  write(queryClient, {
    resource: ref,
    allowed,
    denied: [],
    standing: {
      is_owner: false,
      membership_status: viewer.membership_status,
      is_follower: viewer.is_follower,
      role_ids: [],
    },
    policy: {},
  });
};

export interface CapabilitiesResult {
  readonly byId: ReadonlyMap<string, ResourceCapabilitiesView>;
  readonly status: 'idle' | 'pending' | 'ready' | 'error';
}

/**
 * Resolve capabilities for a set of resources, issuing one request for whatever
 * is missing from the cache.
 *
 * Not a `useQuery`: the cache unit (one resource) and the fetch unit (a batch)
 * differ, which React Query has no native shape for. The effect collects misses
 * and writes each result back under its own key.
 */
export function useCapabilities(refs: readonly ResourceRef[]): CapabilitiesResult {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CapabilitiesResult['status']>('idle');
  const [version, setVersion] = useState(0);

  // A stable identity for the request set, so the effect does not re-run on
  // every render just because the caller built a new array.
  const signature = useMemo(
    () => refs.map(keyOf).sort().join('|'),
    [refs]
  );

  useEffect(() => {
    if (!signature) {
      setStatus('idle');
      return;
    }

    const wanted = signature.split('|').map((entry) => {
      const [type, id] = entry.split(':');
      return { type: type as ResourceScopeType, id };
    });
    const missing = wanted.filter((ref) => read(queryClient, ref) === undefined);
    if (missing.length === 0) {
      setStatus('ready');
      return;
    }

    let cancelled = false;
    setStatus('pending');

    capabilitiesApi
      .resolve({ resources: missing })
      .then((response) => {
        if (cancelled) return;
        response.capabilities.forEach((view) => write(queryClient, view));
        setVersion((current) => current + 1);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        // A failure leaves the provisional values in place rather than blanking
        // the UI; the 403 interceptor and the invalidation event will retry.
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [signature, queryClient]);

  const byId = useMemo(() => {
    const map = new Map<string, ResourceCapabilitiesView>();
    refs.forEach((ref) => {
      const view = read(queryClient, ref);
      if (view) map.set(keyOf(ref), view);
    });
    return map;
    // `version` forces recomputation after a batch write, which does not
    // otherwise notify this hook.
  }, [refs, queryClient, version, status]);

  return { byId, status };
}

/** The single-container case, which is most call sites. */
export function useContainerCapabilities(ref: MessageContainerRef | null): {
  readonly capabilities: ResourceCapabilitiesView | null;
  readonly status: CapabilitiesResult['status'];
} {
  const refs = useMemo(
    () =>
      ref
        ? [{ type: ref.container_type as ResourceScopeType, id: ref.container_id }]
        : [],
    [ref?.container_type, ref?.container_id]
  );
  const { byId, status } = useCapabilities(refs);

  return {
    capabilities: ref
      ? byId.get(`${ref.container_type}:${ref.container_id}`) ?? null
      : null,
    status,
  };
}

export const CAPABILITY_CACHE_OPTIONS = { staleTime: STALE_TIME, gcTime: GC_TIME };
