import { describe, expect, it } from 'vitest';
import type { MessageDoc } from '@/api/types';
import { parseMessage } from './messageParser';

const message = (overrides: Partial<MessageDoc> = {}): MessageDoc =>
  ({
    id: 'm_1',
    container_type: 'channel',
    container_id: 'ch_1',
    conversation_id: 'ch_1',
    sender_id: 'u_1',
    type: 'text',
    reply_mode: null,
    reply_to_message_id: null,
    thread_root_id: null,
    is_thread_root: false,
    thread_reply_count: 0,
    last_thread_reply_at: null,
    reactions: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }) as MessageDoc;

describe('read-status derivation', () => {
  it('is sent when there is no receipt summary at all, as for a channel post', () => {
    const doc = message({ receipt_summary: undefined });
    expect(parseMessage(doc).status).toBe('sent');
  });

  it('is sent when the summary reports zero recipients, as a channel always does', () => {
    const doc = message({
      receipt_summary: { recipient_count: 0, delivered_count: 0, read_count: 0 },
    });
    expect(parseMessage(doc).status).toBe('sent');
  });

  it('is read once every recipient has read it', () => {
    const doc = message({
      receipt_summary: { recipient_count: 2, delivered_count: 2, read_count: 2 },
    });
    expect(parseMessage(doc).status).toBe('read');
  });

  it('is delivered once every recipient has it but not everyone has read it', () => {
    const doc = message({
      receipt_summary: { recipient_count: 2, delivered_count: 2, read_count: 1 },
    });
    expect(parseMessage(doc).status).toBe('delivered');
  });

  it('is sent while delivery is still partial', () => {
    const doc = message({
      receipt_summary: { recipient_count: 2, delivered_count: 1, read_count: 0 },
    });
    expect(parseMessage(doc).status).toBe('sent');
  });
});
