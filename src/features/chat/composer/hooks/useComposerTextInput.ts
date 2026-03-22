import { useEffect, useRef, useState } from 'react';
import type { SendTextInput } from '@/hooks/useChat';
import { getSocket } from '@/socket/socket';
import { EVENTS } from '@/socket/events';

interface UseComposerTextInputParams {
  receiverId: string;
  onSendText: (data: SendTextInput) => Promise<unknown>;
  onClearReplyTarget?: () => void;
}

export function useComposerTextInput({
  receiverId,
  onSendText,
  onClearReplyTarget,
}: UseComposerTextInputParams) {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSendingText, setIsSendingText] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
  };

  const emitTypingStart = () => {
    const socket = getSocket();
    socket?.emit(EVENTS.CLIENT_TYPING_START, { to: receiverId, receiver_id: receiverId });
  };

  const emitTypingStop = () => {
    const socket = getSocket();
    socket?.emit(EVENTS.CLIENT_TYPING_STOP, { to: receiverId, receiver_id: receiverId });
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
    setText(value);

    if (!typingTimeoutRef.current) {
      emitTypingStart();
    }

    resetTypingTimeout();
  };

  const appendText = (value: string) => {
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
      await onSendText({ receiver_id: receiverId, text: trimmedText });
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
