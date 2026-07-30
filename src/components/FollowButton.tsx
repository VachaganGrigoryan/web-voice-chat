import { Clock3, Loader2, UserCheck, UserPlus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { channelsApi } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import {
  useFollowTarget,
  type FollowTargetType,
} from '@/hooks/useFollowRelationships';
import { useAuthStore } from '@/store/authStore';

interface FollowButtonProps {
  targetType: FollowTargetType;
  targetId: string;
}

export function FollowButton({ targetType, targetId }: FollowButtonProps) {
  const currentUserId = useAuthStore((state) => state.userId);

  const channelQuery = useQuery({
    queryKey: ['channels', targetId],
    queryFn: () => channelsApi.get(targetId),
    enabled: targetType === 'channel' && Boolean(targetId),
  });

  const {
    isFollowing,
    isPending,
    isLoading,
    isMutating,
    follow,
    unfollow,
  } = useFollowTarget(targetType, targetId);
  const disabled = isLoading || isMutating;

  // Do not render follow button if target is self user or a channel owned/created by current user
  if (targetType === 'user' && targetId === currentUserId) {
    return null;
  }
  if (
    targetType === 'channel' &&
    currentUserId &&
    channelQuery.data &&
    (channelQuery.data.created_by === currentUserId ||
      (channelQuery.data.owner?.type === 'user' && channelQuery.data.owner?.id === currentUserId))
  ) {
    return null;
  }

  if (isPending) {
    return (
      <Button type="button" size="sm" variant="outline" disabled>
        <Clock3 className="mr-2 h-4 w-4" />
        Pending
      </Button>
    );
  }

  if (isFollowing) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => void unfollow()}
      >
        {isMutating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <UserCheck className="mr-2 h-4 w-4" />
        )}
        Following
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled}
      onClick={() => void follow()}
    >
      {disabled ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <UserPlus className="mr-2 h-4 w-4" />
      )}
      Follow
    </Button>
  );
}
