import { CallMeta, EncryptionMode, MediaMeta, MessageContent, MessageDoc, PollRef } from './types';

export interface ResolvedMessageContent {
  encryption: EncryptionMode;
  /** True when the body is E2EE and cannot be rendered without client-side keys. */
  isEncrypted: boolean;
  text: string | null;
  media: MediaMeta | null;
  call: CallMeta | null;
  attachments: MediaMeta[];
  poll: Record<string, unknown> | null;
  pollRef: PollRef | null;
  sticker: Record<string, unknown> | null;
  location: Record<string, unknown> | null;
  contact: Record<string, unknown> | null;
  linkPreview: Record<string, unknown> | null;
}

type ContentBearing = {
  content?: MessageContent | null;
};

/**
 * Single decrypt/normalize boundary for message bodies. All consumers (bubbles,
 * reply previews, notifications, conversation last-message) should read display
 * text/media/call through this rather than touching `content` directly.
 *
 * Today everything is `encryption: 'none'` and resolves to the plaintext. When E2EE
 * lands, the `e2ee` branch is where ciphertext gets decrypted with local keys.
 */
export function resolveMessageContent(message: ContentBearing): ResolvedMessageContent {
  const content = message.content ?? null;

  if (content && content.encryption === 'e2ee') {
    // TODO(e2ee): decrypt `content.ciphertext` with the recipient device keys.
    return {
      encryption: 'e2ee',
      isEncrypted: true,
      text: null,
      media: null,
      call: null,
      attachments: content.attachments ?? [],
      poll: null,
      pollRef: null,
      sticker: null,
      location: null,
      contact: null,
      linkPreview: null,
    };
  }

  const plaintext = content?.plaintext ?? null;
  return {
    encryption: 'none',
    isEncrypted: false,
    text: plaintext?.text ?? null,
    media: plaintext?.media ?? null,
    call: plaintext?.call ?? null,
    attachments: content?.attachments ?? [],
    poll: plaintext?.poll ?? null,
    pollRef: plaintext?.poll_ref ?? null,
    sticker: plaintext?.sticker ?? null,
    location: plaintext?.location ?? null,
    contact: plaintext?.contact ?? null,
    linkPreview: plaintext?.link_preview ?? null,
  };
}
