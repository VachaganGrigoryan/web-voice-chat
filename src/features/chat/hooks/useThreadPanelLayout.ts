import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getThreadPanelWidths,
  MOBILE_BREAKPOINT,
  THREAD_PANEL_MODES,
  type ThreadPanelMode,
} from '../utils/chatLayoutUtils';

interface UseThreadPanelLayoutParams {
  selectedUser: string | null;
  selectedThreadRootId: string | null;
  isLayoutActive: boolean;
}

export function useThreadPanelLayout({
  selectedUser,
  selectedThreadRootId,
  isLayoutActive,
}: UseThreadPanelLayoutParams) {
  const [threadPanelMode, setThreadPanelMode] = useState<ThreadPanelMode>('center');
  const [isResizingThread, setIsResizingThread] = useState(false);
  const [splitLayoutWidth, setSplitLayoutWidth] = useState(0);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );
  const splitLayoutRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsResizingThread(false);
  }, [selectedUser]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileViewport(window.innerWidth < MOBILE_BREAKPOINT);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!selectedThreadRootId) {
      setIsResizingThread(false);
      return;
    }

    if (isMobileViewport) {
      setThreadPanelMode('full');
    }
  }, [isMobileViewport, selectedThreadRootId]);

  useEffect(() => {
    const node = splitLayoutRef.current;
    if (!node) return;

    const updateWidth = () => {
      setSplitLayoutWidth(node.getBoundingClientRect().width);
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(node);
    return () => observer.disconnect();
  }, [isLayoutActive, selectedThreadRootId, selectedUser]);

  const threadPanelWidths = useMemo(
    () => getThreadPanelWidths(splitLayoutWidth),
    [splitLayoutWidth]
  );

  const updateThreadPanelModeFromPointer = (clientX: number) => {
    if (isMobileViewport) return;

    const layoutRect = splitLayoutRef.current?.getBoundingClientRect();
    if (!layoutRect) return;

    const desiredWidth = layoutRect.right - clientX;
    const nearestMode = THREAD_PANEL_MODES.reduce((closestMode, mode) => {
      const currentDistance = Math.abs(threadPanelWidths[mode] - desiredWidth);
      const closestDistance = Math.abs(threadPanelWidths[closestMode] - desiredWidth);
      return currentDistance < closestDistance ? mode : closestMode;
    }, 'minimal' as ThreadPanelMode);

    setThreadPanelMode(nearestMode);
  };

  useEffect(() => {
    if (!isResizingThread || isMobileViewport || !selectedThreadRootId) {
      return;
    }

    const handlePointerMove = (event: MouseEvent) => {
      updateThreadPanelModeFromPointer(event.clientX);
    };

    const handlePointerUp = () => {
      setIsResizingThread(false);
    };

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [isMobileViewport, isResizingThread, selectedThreadRootId, threadPanelWidths]);

  const threadPanelWidth = isMobileViewport ? '100%' : `${threadPanelWidths[threadPanelMode]}px`;

  const handleResizeHandleMouseDown = (clientX: number) => {
    setIsResizingThread(true);
    updateThreadPanelModeFromPointer(clientX);
  };

  return {
    splitLayoutRef,
    isMobileViewport,
    isResizingThread,
    threadPanelWidth,
    setThreadPanelMode,
    handleResizeHandleMouseDown,
  };
}
