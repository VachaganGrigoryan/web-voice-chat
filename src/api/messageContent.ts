import { CallMeta, EncryptionMode, MediaMeta, MessageContent, MessageDoc } from './types';

export interface ResolvedMessageContent {
  encryption: EncryptionMode;
  /** True when the body is E2EE and cannot be rendered without client-side keys. */
  isEncrypted: boolean;
  text: string | null;
  media: MediaMeta | null;
  call: CallMeta | null;
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
    return { encryption: 'e2ee', isEncrypted: true, text: null, media: null, call: null };
  }

  const plaintext = content?.plaintext ?? null;
  return {
    encryption: 'none',
    isEncrypted: false,
    text: plaintext?.text ?? null,
    media: plaintext?.media ?? null,
    call: plaintext?.call ?? null,
  };
}
