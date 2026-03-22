import { useEffect, useRef, useState } from 'react';

interface UseChatTimelineStateParams {
  enabled: boolean;
  resetKey: string | null;
  latestMessageId: string | null;
  messageIds: string[];
  newestEdge: 'start' | 'end';
  onVisibleMessageIdsChange?: (messageIds: string[]) => void;
}

const BOTTOM_THRESHOLD = 80;

export function useChatTimelineState({
  enabled,
  resetKey,
  latestMessageId,
  messageIds,
  newestEdge,
  onVisibleMessageIdsChange,
}: UseChatTimelineStateParams) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messageElementRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const latestMessageIdRef = useRef<string | null>(null);
  const isNearLatestRef = useRef(true);
  const pendingInitialScrollRef = useRef(false);
  const [pendingNewMessageCount, setPendingNewMessageCount] = useState(0);

  const isNearLatest = (container: HTMLDivElement | null) => {
    if (!container) return true;

    if (newestEdge === 'start') {
      return container.scrollTop <= BOTTOM_THRESHOLD;
    }

    return (
      container.scrollHeight - container.clientHeight - container.scrollTop <= BOTTOM_THRESHOLD
    );
  };

  const emitVisibleMessageIds = () => {
    if (!onVisibleMessageIdsChange || !scrollContainerRef.current) {
      return;
    }

    const containerRect = scrollContainerRef.current.getBoundingClientRect();
    const visibleIds = new Set<string>();

    messageElementRefs.current.forEach((element, messageId) => {
      const rect = element.getBoundingClientRect();
      if (rect.bottom > containerRect.top && rect.top < containerRect.bottom) {
        visibleIds.add(messageId);
      }
    });

    onVisibleMessageIdsChange([...visibleIds]);
  };

  const scrollToLatest = (behavior: ScrollBehavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        container.scrollTo({
          top: newestEdge === 'start' ? 0 : container.scrollHeight,
          behavior,
        });
        isNearLatestRef.current = true;
        setPendingNewMessageCount(0);
      });
    });
  };

  const registerMessageElement = (messageIdsForNode: string[], node: HTMLDivElement | null) => {
    messageIdsForNode.forEach((messageId) => {
      if (node) {
        messageElementRefs.current.set(messageId, node);
      } else {
        messageElementRefs.current.delete(messageId);
      }
    });
  };

  const handleScroll = (container: HTMLDivElement) => {
    const nextIsNearLatest = isNearLatest(container);
    isNearLatestRef.current = nextIsNearLatest;
    if (nextIsNearLatest) {
      setPendingNewMessageCount(0);
    }
    emitVisibleMessageIds();
  };

  useEffect(() => {
    if (!enabled) {
      messageElementRefs.current.clear();
      latestMessageIdRef.current = null;
      isNearLatestRef.current = true;
      pendingInitialScrollRef.current = false;
      setPendingNewMessageCount(0);
      return;
    }

    messageElementRefs.current.clear();
    latestMessageIdRef.current = null;
    isNearLatestRef.current = true;
    pendingInitialScrollRef.current = true;
    setPendingNewMessageCount(0);
  }, [enabled, resetKey]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!latestMessageId) {
      latestMessageIdRef.current = null;
      return;
    }

    if (pendingInitialScrollRef.current || !latestMessageIdRef.current) {
      latestMessageIdRef.current = latestMessageId;
      pendingInitialScrollRef.current = false;
      scrollToLatest('auto');
      return;
    }

    if (latestMessageIdRef.current === latestMessageId) {
      return;
    }

    latestMessageIdRef.current = latestMessageId;

    if (isNearLatestRef.current) {
      scrollToLatest();
      return;
    }

    setPendingNewMessageCount((current) => current + 1);
  }, [enabled, latestMessageId, newestEdge]);

  useEffect(() => {
    if (!enabled || !messageIds.length) {
      return;
    }

    let frame = 0;
    frame = window.requestAnimationFrame(() => {
      emitVisibleMessageIds();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [enabled, messageIds, onVisibleMessageIdsChange]);

  return {
    scrollContainerRef,
    pendingNewMessageCount,
    registerMessageElement,
    handleScroll,
    scrollToLatest,
  };
}
