import type { SendMediaInput, SendTextInput } from '@/hooks/useChat';
import { ComposerReplyTarget } from '../types/message';

export type ComposerPanel = 'emoji' | 'attachments' | null;

export interface ChatComposerProps {
  receiverId: string;
  onSendText: (data: SendTextInput) => Promise<unknown>;
  onSendMedia: (data: SendMediaInput) => Promise<unknown>;
  replyTarget?: ComposerReplyTarget | null;
  onClearReplyTarget?: () => void;
  isUploading?: boolean;
  contextLabel?: string;
}
