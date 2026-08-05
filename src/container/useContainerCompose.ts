import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pollsApi } from '@/api/endpoints';
import { pollQueryKey } from '@/hooks/usePoll';
import type {
  CreatePollRequest,
  CreatePollResponse,
  MessageDoc,
  PreviewMediaKind,
  ReplyMode,
  SendRichContentRequest,
} from '@/api/types';
import { useSocketStore } from '@/socket/socket';
import { integrateCreatedMessage } from './messageCache';
import type { ContainerDescriptor } from './types';

/**
 * Sending, for whichever container the descriptor names.
 *
 * Every path funnels through `integrateCreatedMessage`, so the rule for where a
 * new message lands lives in one tested pure function rather than in four
 * mutation callbacks.
 */

interface BaseMediaPayload {
  file: File;
  text?: string;
  duration_ms?: number;
  reply_mode?: ReplyMode | null;
  reply_to_message_id?: string;
  client_batch_id?: string;
  signal?: AbortSignal;
  onUploadProgress?: (progress: number) => void;
}

export type ComposeMediaInput =
  | (BaseMediaPayload & { type: 'media'; media_kind: PreviewMediaKind })
  | (BaseMediaPayload & { type: 'file'; media_kind?: never });

export interface ComposeTextInput {
  text: string;
  reply_mode?: ReplyMode | null;
  reply_to_message_id?: string;
  style?: { background?: string | null; align?: 'start' | 'center' | null } | null;
}

/**
 * The compat ack the server expects alongside the REST write. Conversations
 * only: there is no channel typing/ack channel, so emitting for one would be a
 * message the server has no handler for.
 */
const emitOutgoing = (
  descriptor: ContainerDescriptor,
  message: MessageDoc,
  type: string
) => {
  if (descriptor.ref.container_type !== 'conversation') return;
  const { socket } = useSocketStore.getState();
  socket?.emit('send_message', {
    conversation_id: message.container_id,
    message_id: message.id,
    type,
    reply_mode: message.reply_mode,
    reply_to_message_id: message.reply_to_message_id,
    thread_root_id: message.thread_root_id,
  });
};

export function useContainerCompose(descriptor: ContainerDescriptor | null) {
  const queryClient = useQueryClient();

  const integrate = (message: MessageDoc, type: string) => {
    if (!descriptor) return;
    emitOutgoing(descriptor, message, type);
    integrateCreatedMessage(queryClient, descriptor.ref, message);
  };

  const sendText = useMutation({
    mutationFn: (input: ComposeTextInput) => {
      if (!descriptor) return Promise.reject(new Error('No container selected'));
      return descriptor.endpoints.sendText(input);
    },
    onSuccess: (message) => integrate(message, 'text'),
  });

  const sendMedia = useMutation({
    mutationFn: (input: ComposeMediaInput) => {
      if (!descriptor) return Promise.reject(new Error('No container selected'));
      return descriptor.endpoints.sendMedia({
        ...input,
        onUploadProgress: input.onUploadProgress
          ? (event: { loaded: number; total?: number }) => {
              if (!event.total) return;
              input.onUploadProgress?.(
                Math.round((event.loaded / event.total) * 100)
              );
            }
          : undefined,
      });
    },
    onSuccess: (message, input) => {
      // The batch id is a client-side correlation for optimistic tiles; the
      // server neither stores nor echoes it.
      const withBatchId = input.client_batch_id
        ? { ...message, client_batch_id: input.client_batch_id }
        : message;
      integrate(withBatchId, input.type);
    },
  });

  const sendRichContent = useMutation({
    mutationFn: (input: SendRichContentRequest) => {
      if (!descriptor) return Promise.reject(new Error('No container selected'));
      return descriptor.endpoints.sendContent(input as unknown as Record<string, unknown>);
    },
    onSuccess: (message) => integrate(message, message.type),
  });

  const createPoll = useMutation({
    mutationFn: (input: CreatePollRequest) => pollsApi.create(input),
    onSuccess: ({ poll, message }: CreatePollResponse) => {
      // Seed the poll cache so the card renders tallies without a second fetch.
      queryClient.setQueryData(pollQueryKey(poll.id), poll);
      integrate(message, message.type);
    },
  });

  return {
    sendText: sendText.mutateAsync,
    sendMedia: sendMedia.mutateAsync,
    sendRichContent: sendRichContent.mutateAsync,
    createPoll: createPoll.mutateAsync,
    isSending:
      sendText.isPending || sendMedia.isPending || sendRichContent.isPending,
  };
}
