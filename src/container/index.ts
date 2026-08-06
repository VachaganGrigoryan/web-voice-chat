/**
 * The container adapter.
 *
 * One set of components serves conversations and channels because the
 * descriptor separates the three things `container_type` used to answer at
 * once: transport (`endpoints`), policy (`capabilities`), and presentation
 * (`presentation`, the only part that varies with the lens).
 */

export type {
  ContainerBadge,
  ContainerCapabilities,
  ContainerDescriptor,
  ContainerEndpoints,
  ContainerEnvelope,
  ContainerIdentity,
  ContainerLens,
  ContainerPolicyEcho,
  ContainerPresentation,
  ContainerRealtime,
  ContainerRoutes,
  ContainerSource,
  ConversationOnlyAffordances,
  JoinAffordance,
  ViewerMembership,
} from './types';

export {
  ACTION,
  DEFAULT_ACTIONS,
  fromPermissionStrings,
  fromPolicy,
  mergeCapabilities,
} from './capabilities';
export type { ViewerCapabilitiesView } from './capabilities';

export {
  NOBODY,
  STANDING,
  commentPolicyRank,
  derivePolicyCapabilities,
  postingPolicyRank,
  satisfies,
  viewerStandingRank,
} from './policy';
export type { PolicyThreshold, StandingRank, ViewerStanding } from './policy';

export {
  containerQueryKeys,
  defaultLensFor,
  refOf,
  resolveContainer,
} from './resolveContainer';

export { endpointsFor } from './endpointsFor';

export {
  applyReactionUpdate,
  clearConversationMessages,
  clearConversationRow,
  containerIdOf,
  integrateCreatedMessage,
  prependMessage,
  prependThreadMessage,
  removeConversationRow,
  resetContainerUnreadCount,
  toggleLocalReactionGroups,
  updateConversationActivity,
  updateConversationPreview,
  updateMessageAcrossGroup,
  updateMessageEverywhere,
  updateThreadRootSummary,
} from './messageCache';

export { seedFromViewerBlock, useCapabilities, useContainerCapabilities } from './useCapabilities';
export {
  invalidateResourceCapabilities,
  useCapabilityInvalidation,
} from './useCapabilityInvalidation';
export { useContainer } from './useContainer';
export { useMarkContainerRead } from './useMarkContainerRead';
export type { UseContainerOptions, UseContainerResult } from './useContainer';
export { useContainerMessages } from './useContainerMessages';
export { useContainerCompose } from './useContainerCompose';
export type { ComposeMediaInput, ComposeTextInput } from './useContainerCompose';
export { useMessageActions } from './useMessageActions';
