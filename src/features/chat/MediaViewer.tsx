import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { downloadFile } from '@/utils/download';
import { CustomVideoPlayer } from './media/players/VideoPlayer';

export interface MediaViewerImageItem {
  id: string;
  url: string;
  downloadName?: string;
}

interface MediaViewerProps {
  open: boolean;
  type: 'image' | 'video';
  url?: string;
  items?: MediaViewerImageItem[];
  initialItemId?: string | null;
  downloadName?: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getTouchDistance = (touches: React.TouchList) => {
  if (touches.length < 2) return 0;
  const [a, b] = [touches[0], touches[1]];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
};

export const MediaViewer: React.FC<MediaViewerProps> = ({
  open,
  type,
  url,
  items = [],
  initialItemId,
  downloadName,
  onClose,
}) => {
  const imageItems = useMemo(() => items.filter((item) => !!item.url), [items]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const panStateRef = useRef<{ active: boolean; startX: number; startY: number; startOffsetX: number; startOffsetY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
  });
  const swipeStateRef = useRef<{ startX: number; deltaX: number } | null>(null);
  const pinchStateRef = useRef<{ distance: number; scale: number } | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const isImageViewer = type === 'image';

  useEffect(() => {
    if (!open) {
      return;
    }

    if (isImageViewer && imageItems.length > 0) {
      const initialIndex = Math.max(
        0,
        imageItems.findIndex((item) => item.id === initialItemId)
      );
      setCurrentIndex(initialIndex === -1 ? 0 : initialIndex);
    } else {
      setCurrentIndex(0);
    }
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [imageItems, initialItemId, isImageViewer, open]);

  const currentImage = isImageViewer ? imageItems[currentIndex] || null : null;
  const canGoPrevious = isImageViewer && currentIndex > 0;
  const canGoNext = isImageViewer && currentIndex < imageItems.length - 1;

  const resetTransform = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const goToIndex = (nextIndex: number) => {
    if (!isImageViewer || imageItems.length === 0) return;
    setCurrentIndex(clamp(nextIndex, 0, imageItems.length - 1));
    resetTransform();
  };

  const goPrevious = () => {
    if (canGoPrevious) {
      goToIndex(currentIndex - 1);
    }
  };

  const goNext = () => {
    if (canGoNext) {
      goToIndex(currentIndex + 1);
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') onClose();
      if (isImageViewer && e.key === 'ArrowLeft') goPrevious();
      if (isImageViewer && e.key === 'ArrowRight') goNext();
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [goNext, goPrevious, isImageViewer, onClose, open]);

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!isImageViewer || !currentImage) return;
    event.preventDefault();
    const nextScale = clamp(scale - event.deltaY * 0.002, MIN_SCALE, MAX_SCALE);
    setScale(nextScale);
    if (nextScale === MIN_SCALE) {
      setOffset({ x: 0, y: 0 });
    }
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isImageViewer || scale <= 1) {
      return;
    }

    event.preventDefault();
    panStateRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    };

    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panStateRef.current.active || scale <= 1) {
      return;
    }

    const deltaX = event.clientX - panStateRef.current.startX;
    const deltaY = event.clientY - panStateRef.current.startY;
    setOffset({
      x: panStateRef.current.startOffsetX + deltaX,
      y: panStateRef.current.startOffsetY + deltaY,
    });
  };

  const handlePointerUp = () => {
    panStateRef.current.active = false;
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isImageViewer) return;

    if (event.touches.length === 2) {
      pinchStateRef.current = {
        distance: getTouchDistance(event.touches),
        scale,
      };
      swipeStateRef.current = null;
      return;
    }

    if (event.touches.length === 1) {
      swipeStateRef.current = {
        startX: event.touches[0].clientX,
        deltaX: 0,
      };
    }
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!isImageViewer) return;

    if (event.touches.length === 2 && pinchStateRef.current) {
      event.preventDefault();
      const nextDistance = getTouchDistance(event.touches);
      const ratio = nextDistance / Math.max(pinchStateRef.current.distance, 1);
      const nextScale = clamp(pinchStateRef.current.scale * ratio, MIN_SCALE, MAX_SCALE);
      setScale(nextScale);
      if (nextScale === MIN_SCALE) {
        setOffset({ x: 0, y: 0 });
      }
      return;
    }

    if (event.touches.length === 1) {
      const touch = event.touches[0];
      if (scale > 1 && swipeStateRef.current) {
        event.preventDefault();
        setOffset((currentOffset) => ({
          x: currentOffset.x + (touch.clientX - swipeStateRef.current!.startX),
          y: currentOffset.y,
        }));
        swipeStateRef.current = {
          startX: touch.clientX,
          deltaX: 0,
        };
        return;
      }

      if (swipeStateRef.current) {
        swipeStateRef.current.deltaX = touch.clientX - swipeStateRef.current.startX;
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isImageViewer) return;

    if (scale === 1 && swipeStateRef.current) {
      if (swipeStateRef.current.deltaX <= -50) {
        goNext();
      } else if (swipeStateRef.current.deltaX >= 50) {
        goPrevious();
      }
    }

    pinchStateRef.current = null;
    swipeStateRef.current = null;
  };

  const activeUrl = isImageViewer ? currentImage?.url : url;
  const activeDownloadName = isImageViewer ? currentImage?.downloadName : downloadName;

  return (
    <AnimatePresence>
      {open && activeUrl ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/95"
          onClick={onClose}
        >
          {isImageViewer ? (
            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-4 text-white">
              <div className="text-sm font-medium">
                {imageItems.length > 0 ? `${currentIndex + 1} / ${imageItems.length}` : ''}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                  onClick={(event) => {
                    event.stopPropagation();
                    void downloadFile(activeUrl, activeDownloadName);
                  }}
                  aria-label="Download media"
                  title="Download"
                >
                  <Download className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose();
                  }}
                  aria-label="Close viewer"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : null}

          {isImageViewer && canGoPrevious ? (
            <button
              type="button"
              className="absolute left-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              onClick={(event) => {
                event.stopPropagation();
                goPrevious();
              }}
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : null}

          {isImageViewer && canGoNext ? (
            <button
              type="button"
              className="absolute right-4 top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              onClick={(event) => {
                event.stopPropagation();
                goNext();
              }}
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          ) : null}

          <div
            ref={contentRef}
            className="flex h-full w-full items-center justify-center overflow-hidden p-4"
            onClick={(event) => event.stopPropagation()}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <AnimatePresence mode="wait">
              {isImageViewer ? (
                <motion.img
                  key={currentImage?.id}
                  initial={{ opacity: 0.5, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0.5, scale: 0.98 }}
                  src={activeUrl}
                  alt={activeDownloadName || 'Fullscreen image'}
                  className="max-h-full max-w-full touch-none object-contain select-none"
                  referrerPolicy="no-referrer"
                  style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                    cursor: scale > 1 ? 'grab' : 'zoom-in',
                  }}
                  draggable={false}
                />
              ) : (
                <motion.div
                  key={activeUrl}
                  initial={{ opacity: 0.5, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0.5, scale: 0.98 }}
                  className="h-full w-full"
                >
                  <CustomVideoPlayer
                    src={activeUrl}
                    autoPlay
                    onClose={onClose}
                    onDownload={() => {
                      void downloadFile(activeUrl, activeDownloadName);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
