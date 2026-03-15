import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface MediaViewerProps {
  open: boolean;
  type: 'image' | 'video';
  url: string;
  mime?: string;
  onClose: () => void;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ open, type, url, mime, onClose }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={onClose}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={24} />
          </button>

          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {type === 'image' ? (
              <img
                src={url}
                alt="Fullscreen preview"
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            ) : (
              <video
                src={url}
                controls
                autoPlay
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
