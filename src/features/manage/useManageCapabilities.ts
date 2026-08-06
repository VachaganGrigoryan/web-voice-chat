import { useMemo } from 'react';
import { ACTION, useCapabilities } from '@/container';
import type { ManageResource } from './types';

export interface ManageCapabilities {
  readonly canManage: boolean;
  readonly canManageMembers: boolean;
  readonly canManageRoles: boolean;
  readonly canInvite: boolean;
  readonly canApproveJoins: boolean;
  readonly canDeleteResource: boolean;
  /** Raw policy fields for management forms. Never used to gate. */
  readonly policy: Readonly<Record<string, unknown>>;
  readonly isLoading: boolean;
}

/**
 * The one capability check the whole management subtree gates on.
 * `resource.manage` decides whether the Manage affordance renders at all;
 * the finer-grained actions (`member.manage`, `role.manage`, `resource.delete`)
 * are requested here rather than in a container's default action set, because
 * putting them there would make every container open more expensive.
 */
export function useManageCapabilities(resource: ManageResource): ManageCapabilities {
  const refs = useMemo(() => [resource], [resource.type, resource.id]);
  const { byId, status } = useCapabilities(refs);
  const view = byId.get(`${resource.type}:${resource.id}`);
  const allowed = new Set(view?.allowed ?? []);
  const can = (action: string) => allowed.has(action);

  return {
    canManage: can(ACTION.resourceManage),
    canManageMembers: can(ACTION.memberManage),
    canManageRoles: can(ACTION.roleManage),
    canInvite: can(ACTION.memberInvite),
    canApproveJoins: can(ACTION.memberApprove),
    canDeleteResource: can(ACTION.resourceDelete),
    policy: view?.policy ?? {},
    isLoading: status === 'idle' || status === 'pending',
  };
}
