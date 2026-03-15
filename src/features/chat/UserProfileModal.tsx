import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/api/endpoints';
import { User, UserSummary } from '@/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Loader2, Lock, User as UserIcon } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  initialData?: UserSummary | null;
  canAccessProfile: boolean;
}

function getDisplayName(user?: Pick<UserSummary, 'display_name' | 'username' | 'id'> | Pick<User, 'display_name' | 'username' | 'id'> | null) {
  return user?.display_name || user?.username || user?.id || 'Unknown User';
}

function isUnavailableError(error: any) {
  const status = error?.response?.status;
  return status === 403 || status === 404;
}

export function UserProfileModal({
  isOpen,
  onClose,
  userId,
  initialData,
  canAccessProfile,
}: UserProfileModalProps) {
  const {
    data: profile,
    error,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['user-profile', userId],
    queryFn: async () => {
      const response = await usersApi.getUser(userId!);
      return response.data.data;
    },
    enabled: isOpen && !!userId && canAccessProfile,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const displayUser = useMemo(() => profile || initialData || null, [profile, initialData]);
  const displayName = getDisplayName(displayUser);
  const username = displayUser?.username || null;
  const avatarUrl = displayUser?.avatar?.url || null;
  const bio = profile?.bio || null;
  const profileError = error as any;
  const showUnavailableMessage = !canAccessProfile || isUnavailableError(profileError);
  const showGenericError = !!profileError && !showUnavailableMessage;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader>
          <div className="border-b px-6 py-4 md:px-8">
            <DialogTitle>Profile</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-8 p-6 md:p-8">
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              <div className="relative shrink-0">
                <Avatar className="h-28 w-28 border-4 border-background shadow-sm">
                  {avatarUrl ? <AvatarImage src={avatarUrl} className="object-cover" /> : null}
                  <AvatarFallback className="bg-muted text-3xl">
                    {displayName[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="space-y-1 pt-2 text-center sm:text-left">
                <h3 className="text-xl font-semibold">{displayName}</h3>
                <p className="text-sm text-muted-foreground">
                  {username ? `@${username}` : userId || 'Unknown user'}
                </p>
                <p className="max-w-xs pt-2 text-xs text-muted-foreground">
                  Basic profile information visible from chat.
                </p>
              </div>
            </div>

            {isLoading && !displayUser ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : showUnavailableMessage ? (
              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Profile is not available</span>
              </div>
            ) : showGenericError ? (
              <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                <UserIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Failed to load profile</span>
              </div>
            ) : (
              <div className="max-w-xl space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="profile-username">Username</Label>
                  <Input
                    id="profile-username"
                    value={username ? `@${username}` : ''}
                    readOnly
                    placeholder="No username"
                    className="max-w-md"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-display-name">Display Name</Label>
                  <Input
                    id="profile-display-name"
                    value={displayUser?.display_name || ''}
                    readOnly
                    placeholder="No display name"
                    className="max-w-md"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-id">User ID</Label>
                  <Input
                    id="profile-id"
                    value={userId || ''}
                    readOnly
                    className="max-w-md"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profile-bio">Bio</Label>
                  <textarea
                    id="profile-bio"
                    value={bio || ''}
                    readOnly
                    placeholder="No bio provided"
                    className="flex min-h-[100px] w-full max-w-md resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>

                {isFetching ? (
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Updating profile…
                  </div>
                ) : null}
              </div>
            )}

            {!displayUser && !isLoading && !showUnavailableMessage && !showGenericError ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
                <UserIcon className="h-10 w-10 opacity-20" />
                <span className="text-sm">Profile is not available</span>
              </div>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
