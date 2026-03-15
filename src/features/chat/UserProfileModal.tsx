import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { UserSummary, User } from '@/api/types';
import { usersApi } from '@/api/endpoints';
import { Loader2, User as UserIcon } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  initialData?: UserSummary;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({ isOpen, onClose, userId, initialData }) => {
  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      setIsLoading(true);
      setError(null);
      usersApi.getUser(userId)
        .then(res => {
          setProfile(res.data.data);
        })
        .catch(err => {
          // If 403 or 404, we can assume profile is not available
          if (err.response?.status === 403 || err.response?.status === 404) {
            setError('Profile is not available');
          } else {
            setError('Failed to load profile');
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setProfile(null);
      setError(null);
    }
  }, [isOpen, userId]);

  const isPingAccepted = initialData?.ping_status === 'accepted';
  const isProfileAvailable = profile ? (!profile.is_private || isPingAccepted) : false;

  const displayData = profile || initialData;
  const displayName = displayData?.display_name || displayData?.username || 'Unknown User';
  const username = displayData?.username;
  const avatarUrl = displayData?.avatar?.url;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center justify-center py-6 space-y-4">
          {isLoading && !profile && !initialData ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : error && !initialData ? (
            <div className="text-center text-muted-foreground">
              <UserIcon className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>{error}</p>
            </div>
          ) : (
            <>
              <Avatar className="h-24 w-24 border-2">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt={displayName} />
                ) : null}
                <AvatarFallback className="text-2xl">
                  {displayName[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="text-center space-y-1">
                <h3 className="text-xl font-semibold">{displayName}</h3>
                {username && (
                  <p className="text-sm text-muted-foreground">@{username}</p>
                )}
              </div>

              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-4" />
              ) : error ? (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-center text-muted-foreground w-full">
                  {error}
                </div>
              ) : profile && !isProfileAvailable ? (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-center text-muted-foreground w-full">
                  Profile is not available
                </div>
              ) : profile && profile.bio ? (
                <div className="mt-4 w-full px-4">
                  <h4 className="text-sm font-medium mb-2 text-muted-foreground">Bio</h4>
                  <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-lg">
                    {profile.bio}
                  </p>
                </div>
              ) : profile ? (
                <div className="mt-4 text-sm text-muted-foreground italic">
                  No bio provided
                </div>
              ) : null}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
