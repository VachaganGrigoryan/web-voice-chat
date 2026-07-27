import { Clock3, Loader2, UserCheck, UserPlus } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import {
  useFollowTarget,
  type FollowTargetType,
} from '@/hooks/useFollowRelationships';

interface FollowButtonProps {
  targetType: FollowTargetType;
  targetId: string;
}

export function FollowButton({ targetType, targetId }: FollowButtonProps) {
  const {
    isFollowing,
    isPending,
    isLoading,
    isMutating,
    follow,
    unfollow,
  } = useFollowTarget(targetType, targetId);
  const disabled = isLoading || isMutating;

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
