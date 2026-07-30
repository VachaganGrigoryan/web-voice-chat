import type { CallPeerUserSummary } from '@/api/types';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

export function getPeerLabel(peerUser: CallPeerUserSummary | null) {
  return peerUser?.display_name || peerUser?.username || peerUser?.id || 'Unknown user';
}

export function getAvatarUrl(peerUser: CallPeerUserSummary | null) {
  if (!peerUser?.avatar || typeof peerUser.avatar !== 'object') {
    return undefined;
  }

  const url = peerUser.avatar.url;
  return typeof url === 'string' ? url : undefined;
}

export function formatCountdown(milliseconds: number | null) {
  if (milliseconds === null) {
    return null;
  }

  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/** @deprecated Use `useIsMobile` from '@/hooks/useIsMobile' directly. */
export const useIsMobileViewport = useIsMobile;

export function CallPeerAvatar({
  peerLabel,
  avatarUrl,
  className,
  fallbackClassName,
}: {
  peerLabel: string;
  avatarUrl?: string;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar className={className}>
      {avatarUrl ? <AvatarImage src={avatarUrl} className="object-cover" /> : null}
      <AvatarFallback className={cn('bg-white/10 text-white', fallbackClassName)}>
        {peerLabel[0]?.toUpperCase() || '?'}
      </AvatarFallback>
    </Avatar>
  );
}
