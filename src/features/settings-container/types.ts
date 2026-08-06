import type { ResourceRef } from '@/api/types';
import type { ContainerDescriptor } from '@/container';
import type { SettingsSubjectKind } from './sections/registry';

/**
 * What the settings component is configuring.
 *
 * A space is included even though it is not a message container, because it
 * shares the role, membership, invite and join-request endpoints and therefore
 * the same sections. That is why `descriptor` is nullable rather than the
 * subject being a descriptor: sections that need container state ask for it and
 * the registry keeps them off a space in the first place.
 */
export interface SettingsSubject {
  readonly kind: SettingsSubjectKind;
  /** The scope the capability, role and membership endpoints are keyed by. */
  readonly resource: ResourceRef;
  readonly title: string;
  readonly descriptor: ContainerDescriptor | null;
}

export const subjectKindFromDescriptor = (
  descriptor: ContainerDescriptor
): Exclude<SettingsSubjectKind, 'space'> => {
  if (descriptor.source.kind === 'channel') return 'channel';
  return descriptor.source.conversation.type === 'dm' ? 'dm' : 'group';
};

/** The subject for a container, derived entirely from its descriptor. */
export const subjectFromDescriptor = (descriptor: ContainerDescriptor): SettingsSubject => ({
  kind: subjectKindFromDescriptor(descriptor),
  resource: {
    type: descriptor.source.kind === 'channel' ? 'channel' : 'conversation',
    id: descriptor.ref.container_id,
  },
  title: descriptor.identity.title,
  descriptor,
});

/** A space has no container descriptor; the registry keeps container-only sections off it. */
export const subjectFromSpace = (spaceId: string, name: string): SettingsSubject => ({
  kind: 'space',
  resource: { type: 'space', id: spaceId },
  title: name,
  descriptor: null,
});
