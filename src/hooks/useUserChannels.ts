import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/api/endpoints';

/** A user's public profile channels (main channel first), for profile tabs. */
export function useUserChannels(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['user-channels', userId],
    queryFn: () => usersApi.getUserChannels(userId as string),
    enabled: Boolean(userId),
  });
}
