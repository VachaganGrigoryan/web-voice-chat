import type { ResourceRef } from '@/api/types';

/** A resource being managed. Reuses the same scope type the capabilities API already speaks. */
export type ManageResource = ResourceRef;

export type ManageSectionId = 'general' | 'access' | 'members' | 'roles' | 'invites' | 'requests' | 'danger';
