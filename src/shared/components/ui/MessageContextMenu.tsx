import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '@/features/chat/types/message';
import { cn } from '@/shared/lib/utils';

interface MessageContextMenuProps {
  message: ChatMessage;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShowDetails: () => void;
  position: { x: number; y: number };
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  message,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onShowDetails,
  position,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] bg-background border border-border rounded-lg shadow-lg py-1 w-40"
      style={{ top: position.y, left: position.x }}
    >
      <button onClick={() => { onEdit(); onClose(); }} className="w-full text-left px-4 py-2 text-sm hover:bg-muted">Edit</button>
      <button onClick={() => { onDelete(); onClose(); }} className="w-full text-left px-4 py-2 text-sm hover:bg-muted text-destructive">Delete</button>
      <button onClick={() => { onShowDetails(); onClose(); }} className="w-full text-left px-4 py-2 text-sm hover:bg-muted">Show Details</button>
    </div>
  );
};
