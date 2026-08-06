import type {
  ConnectionListItem,
  CreatePollRequest,
  MessageContainerRef,
} from '@/api/types';
import type { SendMediaInput, SendRichContentInput, SendTextInput } from '@/features/chat/types/sendInputs';
import { ComposerReplyTarget } from '../types/message';

export type ComposerPanel = 'emoji' | 'attachments' | null;

/**
 * The chrome the composer wears. `inline-bar` is the chat timeline's docked
 * row; `post-box` is the feed's large body, used inside the add-post modal.
 * Both are the same implementation — the panels, dialogs, upload controller and
 * send handlers are shared, so there is exactly one place that uploads a file.
 */
export type ComposerPreset = 'inline-bar' | 'post-box';

export interface ChatComposerProps {
  /** The container being written into — a conversation or a channel. */
  container: MessageContainerRef;
  onSendText: (data: SendTextInput) => Promise<unknown>;
  onSendMedia: (data: SendMediaInput) => Promise<unknown>;
  onSendRichContent: (data: SendRichContentInput) => Promise<unknown>;
  onCreatePoll: (data: CreatePollRequest) => Promise<unknown>;
  contacts?: ConnectionListItem[];
  replyTarget?: ComposerReplyTarget | null;
  onClearReplyTarget?: () => void;
  isUploading?: boolean;
  contextLabel?: string;
  /** Persist/restore an unsent draft per conversation (main composer only). */
  enableDraft?: boolean;
  /** Defaults to the chat timeline's docked row. */
  preset?: ComposerPreset;
  /** `post-box` only: called after a successful send, to close the modal. */
  onSent?: () => void;
  /** `post-box` only: the label on the primary button. */
  submitLabel?: string;
}
