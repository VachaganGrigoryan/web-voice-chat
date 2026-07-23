import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { pollsApi } from '@/api/endpoints';
import { extractApiError } from '@/api/errors';
import type { PollView } from '@/api/types';

export const pollQueryKey = (pollId: string) => ['poll', pollId] as const;

interface UsePollOptions {
  enabled?: boolean;
}

/**
 * Reads and mutates a first-class poll. The poll message card renders from this
 * (one cached fetch per poll id), decoupled from the message cache. Realtime
 * `poll_updated` events refetch this query for a viewer-correct view.
 */
export function usePoll(pollId: string, options?: UsePollOptions) {
  const queryClient = useQueryClient();
  const key = pollQueryKey(pollId);

  const query = useQuery({
    queryKey: key,
    queryFn: () => pollsApi.get(pollId),
    enabled: (options?.enabled ?? true) && Boolean(pollId),
  });

  const setPoll = (poll: PollView) => queryClient.setQueryData(key, poll);
  const onError = (error: unknown) =>
    toast.error(extractApiError(error, 'Poll action failed'));

  const voteMutation = useMutation({
    mutationFn: (optionIds: string[]) => pollsApi.vote(pollId, optionIds),
    onMutate: async (optionIds) => {
      // Optimistically reflect the caller's own selection; server response
      // reconciles the authoritative tallies/visibility.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PollView>(key);
      if (previous) {
        setPoll({ ...previous, my_option_ids: optionIds });
      }
      return { previous };
    },
    onSuccess: setPoll,
    onError: (error, _optionIds, context) => {
      if (context?.previous) setPoll(context.previous);
      onError(error);
    },
  });

  const retractMutation = useMutation({
    mutationFn: () => pollsApi.retract(pollId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PollView>(key);
      if (previous) {
        setPoll({ ...previous, my_option_ids: [] });
      }
      return { previous };
    },
    onSuccess: setPoll,
    onError: (error, _vars, context) => {
      if (context?.previous) setPoll(context.previous);
      onError(error);
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => pollsApi.close(pollId),
    onSuccess: setPoll,
    onError,
  });

  return {
    poll: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    vote: (optionIds: string[]) => voteMutation.mutate(optionIds),
    retract: () => retractMutation.mutate(),
    close: () => closeMutation.mutate(),
    isVoting: voteMutation.isPending,
    isRetracting: retractMutation.isPending,
    isClosing: closeMutation.isPending,
  };
}
