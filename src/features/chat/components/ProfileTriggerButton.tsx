import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

interface ProfileTriggerButtonProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  avatarUrl?: string | null;
  fallback: string;
  onClick: () => void;
  disabled?: boolean;
  online?: boolean;
  className?: string;
  avatarClassName?: string;
}

export function ProfileTriggerButton({
  title,
  subtitle,
  avatarUrl,
  fallback,
  onClick,
  disabled = false,
  online = false,
  className,
  avatarClassName,
}: ProfileTriggerButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 rounded-lg p-1.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60",
        className
      )}
    >
      <div className="relative shrink-0">
        <Avatar className={cn("h-8 w-8", avatarClassName)}>
          {avatarUrl ? <AvatarImage src={avatarUrl} className="object-cover" /> : null}
          <AvatarFallback>{fallback}</AvatarFallback>
        </Avatar>
        {online ? (
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{title}</div>
        {subtitle ? (
          <div className="truncate text-[10px] text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
    </button>
  );
}
