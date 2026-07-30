import { useState } from 'react';
import type { ConversationType } from '@/api/types';

/**
 * Bulk multi-select over inbox conversation rows. Channels aren't selectable —
 * there is no bulk channel-inbox-state endpoint — so this only ever tracks
 * conversation ids.
 */
export function useInboxSelection() {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Type the multi-select is locked to, derived from the first checked item.
  // Selecting a conversation of a different type is disabled while this is set.
  const [selectionType, setSelectionType] = useState<ConversationType | null>(null);

  const enterSelectionMode = () => setSelectionMode(true);

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
    setSelectionType(null);
  };

  const toggleSelectionMode = () => (selectionMode ? exitSelectionMode() : enterSelectionMode());

  const toggleSelected = (conversationId: string, type: ConversationType) => {
    setSelectedIds((current) => {
      if (current.includes(conversationId)) {
        const next = current.filter((id) => id !== conversationId);
        if (next.length === 0) {
          setSelectionType(null);
        }
        return next;
      }
      // First selection locks the allowed type; ignore mismatched types.
      if (current.length === 0) {
        setSelectionType(type);
      } else if (selectionType && type !== selectionType) {
        return current;
      }
      return [...current, conversationId];
    });
  };

  const isSelectionDisabledFor = (type: ConversationType, id: string) =>
    selectionMode && selectionType !== null && type !== selectionType && !selectedIds.includes(id);

  return {
    selectionMode,
    selectedIds,
    selectionType,
    toggleSelectionMode,
    exitSelectionMode,
    toggleSelected,
    isSelectionDisabledFor,
  };
}
