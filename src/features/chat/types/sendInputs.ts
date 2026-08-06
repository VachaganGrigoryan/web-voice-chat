import type { MessageContainerRef, SendRichContentRequest } from '@/api/types';
import type { ComposeMediaInput, ComposeTextInput } from '@/container';

/**
 * Composer input shapes.
 *
 * The container adapter applies the container ref itself, so the compose types
 * carry no `container_type`/`container_id`. These aliases keep the ref optional
 * for the media/recorder components that were written to pass it, without
 * letting a caller pick a different container than the open one.
 */

export type SendMediaInput = ComposeMediaInput & Partial<MessageContainerRef>;
export type SendTextInput = ComposeTextInput & Partial<MessageContainerRef>;
export type SendRichContentInput = SendRichContentRequest;

/**
 * Reaction input. `container_*` is accepted and ignored: the flat reaction route
 * is container-agnostic and the adapter locates the message in whichever cache
 * holds it, so the caller no longer has to know where it lives.
 */
export interface ToggleReactionInput extends Partial<MessageContainerRef> {
  messageId: string;
  emoji: string;
}
