import type { ResourceRef } from '@/api/types';

/** A resource being managed. Reuses the same scope type the capabilities API already speaks. */
export type ManageResource = ResourceRef;

/**
 * One section vocabulary, owned by the settings registry so the management
 * route and the in-chat slide-over cannot drift apart.
 */
export type { SettingsSectionId as ManageSectionId } from '@/features/settings-container/sections/registry';
