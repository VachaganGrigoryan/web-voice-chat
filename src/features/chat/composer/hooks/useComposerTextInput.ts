import { useEffect, useRef, useState } from 'react';
import type { MessageContainerRef } from '@/api/types';
import type { ConversationOnlyAffordances } from '@/container/types';
import type { SendTextInput } from '@/features/chat/types/sendInputs';
import { getSocket } from '@/socket/socket';
import { EVENTS } from '@/socket/events';

const DRAFT_SAVE_DEBOUNCE_MS = 800;

interface UseComposerTextInputParams {
  container: MessageContainerRef;
  onSendText: (data: SendTextInput) => Promise<unknown>;
  onClearReplyTarget?: () => void;
  /** Persist/restore an unsent draft (main composer only); absent for a channel. */
  drafts?: ConversationOnlyAffordances['drafts'] | null;
}

export function useComposerTextInput({
  container,
  onSendText,
  onClearReplyTarget,
  drafts = null,
}: UseComposerTextInputParams) {
  const containerId = container.container_id;
  const containerType = container.container_type;
  // The group is rebuilt whenever presence or the conversation changes; the
  // effects below key on its presence, not its identity, so a presence update
  // cannot re-run the restore mid-typing.
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const hasDrafts = !!drafts;

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
    // Drafts belong to the conversation-only group, which a channel lacks.
    if (!hasDrafts || !containerId) return;
    let cancelled = false;
    hasUserEditedRef.current = false;
    draftsRef.current
      ?.load()
      .then((draft) => {
        if (cancelled) return;
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
  }, [hasDrafts, containerId]);

  // Debounced persistence of the current draft.
  useEffect(() => {
    if (!hasDrafts || !containerId || !hasUserEditedRef.current) return;
    const timeout = setTimeout(() => {
      const trimmed = text.trim();
      const current = draftsRef.current;
      if (!current) return;
      if (trimmed) {
        void current.save(trimmed).catch(() => {});
      } else {
        void current.clear().catch(() => {});
      }
    }, DRAFT_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [hasDrafts, containerId, text]);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  };

  const emitTypingStart = () => {
    const socket = getSocket();
    if (!containerId) return;
    socket?.emit(EVENTS.CLIENT_TYPING_START, {
      container_type: containerType,
      container_id: containerId,
    });
  };

  const emitTypingStop = () => {
    const socket = getSocket();
    if (!containerId) return;
    socket?.emit(EVENTS.CLIENT_TYPING_STOP, {
      container_type: containerType,
      container_id: containerId,
    });
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

  const stopTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    emitTypingStop();
  };

  const clearTextAfterSend = () => {
    setText('');
    onClearReplyTarget?.();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
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

  const handleSendText = async (
    style?: { background?: string | null; align?: 'start' | 'center' | null } | null
  ) => {
    const trimmedText = text.trim();
    if (!trimmedText || isSendingText) {
      return false;
    }

    stopTyping();

    setIsSendingText(true);
    try {
      await onSendText({
        ...container,
        text: trimmedText,
        ...(style ? { style } : {}),
      });
      clearTextAfterSend();
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
    stopTyping,
    clearTextAfterSend,
    blurTextarea: () => textareaRef.current?.blur(),
    focusTextarea: () => textareaRef.current?.focus(),
    resizeTextarea,
  };
}
