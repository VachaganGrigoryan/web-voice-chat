import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { conversationsApi } from '@/api/endpoints';
import type { ConversationFolder } from '@/api/types';
import { useConversationActions } from './useConversationActions';

/**
 * The caller's folders, resolved server-side so they survive even when all of a
 * folder's conversations are archived or past the active inbox page (unlike the
 * old client-side derivation from the loaded conversation list).
 *
 * The active/renaming UI state used to live in the sidebar component; it lives
 * here instead so the inbox only needs one hook for "everything about folders".
 */
export const useConversationFolders = (enabled = true) => {
  const query = useQuery({
    queryKey: ['conversations', 'folders'],
    queryFn: () => conversationsApi.listFolders(),
    enabled,
  });

  const { renameFolder, deleteFolder } = useConversationActions();

  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const startRenamingFolder = (folder: string) => {
    setRenamingFolder(folder);
    setRenameValue(folder);
  };

  const cancelRenamingFolder = () => setRenamingFolder(null);

  const submitRenamingFolder = () => {
    const trimmed = renameValue.trim();
    if (!renamingFolder || !trimmed || trimmed === renamingFolder) {
      setRenamingFolder(null);
      return;
    }

    renameFolder.mutate(
      { name: renamingFolder, newName: trimmed },
      {
        onSuccess: () => {
          if (activeFolder === renamingFolder) {
            setActiveFolder(trimmed);
          }
          setRenamingFolder(null);
        },
      }
    );
  };

  const removeFolder = (folder: string) => {
    deleteFolder.mutate(folder, {
      onSuccess: () => {
        if (activeFolder === folder) {
          setActiveFolder(null);
        }
      },
    });
  };

  const folders: ConversationFolder[] = query.data ?? [];
  const folderNames = folders.map((folder) => folder.name);

  return {
    folders,
    folderNames,
    isLoading: query.isLoading,
    activeFolder,
    setActiveFolder,
    renamingFolder,
    renameValue,
    setRenameValue,
    startRenamingFolder,
    cancelRenamingFolder,
    submitRenamingFolder,
    removeFolder,
    isRenamingFolder: renameFolder.isPending,
    isDeletingFolder: deleteFolder.isPending,
  };
};
