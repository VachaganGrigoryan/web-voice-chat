import { ChangeEvent, RefObject } from 'react';
import { User } from '@/api/types';
import { PanelSection } from '@/components/panel/PanelPageLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Camera, Loader2, Trash2 } from 'lucide-react';

interface ProfileSettingsTabProps {
  profile: User | null | undefined;
  username: string;
  setUsername: (value: string) => void;
  displayName: string;
  setDisplayName: (value: string) => void;
  bio: string;
  setBio: (value: string) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleAvatarUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDeleteAvatar: () => Promise<void>;
  isUploadingAvatar: boolean;
  isDeletingAvatar: boolean;
}

export default function ProfileSettingsTab({
  profile,
  username,
  setUsername,
  displayName,
  setDisplayName,
  bio,
  setBio,
  fileInputRef,
  handleAvatarUpload,
  handleDeleteAvatar,
  isUploadingAvatar,
  isDeletingAvatar,
}: ProfileSettingsTabProps) {
  return (
    <>
      <PanelSection title="Identity" description="Update your public identity details and avatar.">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            <Avatar className="h-28 w-28 border-4 border-background shadow-sm">
              {profile?.avatar ? <AvatarImage src={profile.avatar.url} className="object-cover" /> : null}
              <AvatarFallback className="bg-muted text-3xl">
                {(profile?.display_name || profile?.username || profile?.email || '?')[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-full bg-black/40 opacity-0 backdrop-blur-sm transition-opacity hover:opacity-100">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-white hover:bg-white/20 hover:text-white"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
              >
                {isUploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </Button>
              {profile?.avatar ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full text-red-300 hover:bg-white/20 hover:text-red-300"
                  onClick={handleDeleteAvatar}
                  disabled={isDeletingAvatar}
                >
                  {isDeletingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>

          <div className="space-y-1 pt-2 text-center sm:text-left">
            <div className="text-xl font-semibold">{profile?.display_name || profile?.username || 'User'}</div>
            <div className="text-sm text-muted-foreground">{profile?.email}</div>
            <div className="max-w-sm pt-2 text-sm text-muted-foreground">
              Adjust your avatar, display name, username, and bio from the same profile panel.
            </div>
          </div>
        </div>
      </PanelSection>

      <PanelSection title="Profile Fields" description="These values are used across chat, discovery, and invitations.">
        <div className="max-w-xl space-y-5">
          <div className="space-y-2">
            <Label htmlFor="settings-username">Username</Label>
            <Input
              id="settings-username"
              name="profile-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Choose a unique username"
              className="max-w-md"
              autoComplete="off"
              data-bwignore="true"
              data-1p-ignore="true"
              data-lpignore="true"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-display-name">Display Name</Label>
            <Input
              id="settings-display-name"
              name="profile-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="How others see you"
              className="max-w-md"
              autoComplete="off"
              data-bwignore="true"
              data-1p-ignore="true"
              data-lpignore="true"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="settings-bio">Bio</Label>
            <textarea
              id="settings-bio"
              name="profile-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="A little about yourself"
              className="flex min-h-[100px] w-full max-w-md resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              autoComplete="off"
              data-bwignore="true"
              data-1p-ignore="true"
              data-lpignore="true"
            />
          </div>
        </div>
      </PanelSection>
    </>
  );
}
