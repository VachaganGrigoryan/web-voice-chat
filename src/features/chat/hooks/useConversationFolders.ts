import { useQuery } from '@tanstack/react-query';
import { conversationsApi } from '@/api/endpoints';
import type { ConversationFolder } from '@/api/types';

/**
 * The caller's folders, resolved server-side so they survive even when all of a
 * folder's conversations are archived or past the active inbox page (unlike the
 * old client-side derivation from the loaded conversation list).
 */
export const useConversationFolders = (enabled = true) => {
  const query = useQuery({
    queryKey: ['conversations', 'folders'],
    queryFn: () => conversationsApi.listFolders(),
    enabled,
  });

  const folders: ConversationFolder[] = query.data ?? [];
  const folderNames = folders.map((folder) => folder.name);

  return { folders, folderNames, isLoading: query.isLoading };
};
