import { useEffect, useRef, useState } from 'react';
import type { SendTextInput } from '@/hooks/useChat';
import { conversationsApi } from '@/api/endpoints';
import { getSocket } from '@/socket/socket';
import { EVENTS } from '@/socket/events';

const DRAFT_SAVE_DEBOUNCE_MS = 800;

interface UseComposerTextInputParams {
  receiverId: string;
  onSendText: (data: SendTextInput) => Promise<unknown>;
  onClearReplyTarget?: () => void;
  /** Persist/restore an unsent draft per conversation (main composer only). */
  enableDraft?: boolean;
}

export function useComposerTextInput({
  receiverId,
  onSendText,
  onClearReplyTarget,
  enableDraft = false,
}: UseComposerTextInputParams) {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSendingText, setIsSendingText] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only persist once the user actually edits, so restoring a draft (or an empty
  // composer on mount) never races the loader into clearing the stored draft.
  const hasUserEditedRef = useRef(false);

  // Restore any saved draft when the conversation changes.
  useEffect(() => {
    if (!enableDraft || !receiverId) return;
    let cancelled = false;
    hasUserEditedRef.current = false;
    conversationsApi
      .getDraft(receiverId)
      .then((participant) => {
        if (cancelled) return;
        const draft = participant.draft_text;
        if (draft) {
          setText((current) => (current ? current : draft));
        }
      })
      .catch(() => {
        // No draft, or the caller is not a participant — nothing to restore.
      });
    return () => {
      cancelled = true;
    };
  }, [enableDraft, receiverId]);

  // Debounced persistence of the current draft.
  useEffect(() => {
    if (!enableDraft || !receiverId || !hasUserEditedRef.current) return;
    const timeout = setTimeout(() => {
      const trimmed = text.trim();
      if (trimmed) {
        void conversationsApi.setDraft(receiverId, trimmed).catch(() => {});
      } else {
        void conversationsApi.clearDraft(receiverId).catch(() => {});
      }
    }, DRAFT_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [enableDraft, receiverId, text]);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  };

  const emitTypingStart = () => {
    const socket = getSocket();
    socket?.emit(EVENTS.CLIENT_TYPING_START, { conversation_id: receiverId });
  };

  const emitTypingStop = () => {
    const socket = getSocket();
    socket?.emit(EVENTS.CLIENT_TYPING_STOP, { conversation_id: receiverId });
  };

  const resetTypingTimeout = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      emitTypingStop();
      typingTimeoutRef.current = null;
    }, 2000);
  };

  useEffect(() => {
    resizeTextarea();
  }, [text]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      emitTypingStop();
    };
  }, []);

  const handleTextChange = (value: string) => {
    hasUserEditedRef.current = true;
    setText(value);

    if (!typingTimeoutRef.current) {
      emitTypingStart();
    }

    resetTypingTimeout();
  };

  const appendText = (value: string) => {
    hasUserEditedRef.current = true;
    setText((current) => `${current}${value}`);

    if (!typingTimeoutRef.current) {
      emitTypingStart();
    }

    resetTypingTimeout();
  };

  const handleSendText = async () => {
    const trimmedText = text.trim();
    if (!trimmedText || isSendingText) {
      return false;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    emitTypingStop();

    setIsSendingText(true);
    try {
      await onSendText({ conversation_id: receiverId, text: trimmedText });
      setText('');
      onClearReplyTarget?.();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      return true;
    } finally {
      setIsSendingText(false);
    }
  };

  return {
    text,
    hasText: text.trim().length > 0,
    isFocused,
    isSendingText,
    textareaRef,
    setIsFocused,
    setText,
    handleTextChange,
    appendText,
    handleSendText,
    blurTextarea: () => textareaRef.current?.blur(),
    focusTextarea: () => textareaRef.current?.focus(),
    resizeTextarea,
  };
}
