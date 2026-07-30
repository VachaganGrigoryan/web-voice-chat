import type {
  ConnectionListItem,
  CreatePollRequest,
  MessageContainerRef,
} from '@/api/types';
import type { SendMediaInput, SendRichContentInput, SendTextInput } from '@/features/chat/types/sendInputs';
import { ComposerReplyTarget } from '../types/message';

export type ComposerPanel = 'emoji' | 'attachments' | null;

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
}
