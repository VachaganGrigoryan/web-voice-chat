import { useCapabilityInvalidation } from './useCapabilityInvalidation';

/**
 * Mounts capability-cache invalidation once for the whole app.
 *
 * At app level rather than inside a route, because capabilities are read by the
 * feed, channel, profile and management surfaces too — not just chat. A stale
 * entry has to self-correct wherever the user happens to be.
 */
export default function CapabilityInvalidationRoot() {
  useCapabilityInvalidation();
  return null;
}
