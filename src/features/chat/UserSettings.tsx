import React, { useState, useRef, useEffect } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { X, Camera, Trash2, Loader2, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserSettings({ isOpen, onClose }: UserSettingsProps) {
  const { 
    profile, 
    updateProfile, 
    updateUsername, 
    uploadAvatar, 
    deleteAvatar,
    isUpdatingProfile,
    isUpdatingUsername,
    isUploadingAvatar,
    isDeletingAvatar
  } = useProfile();

  const [username, setUsername] = useState(profile?.username || '');
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [isPrivate, setIsPrivate] = useState(profile?.is_private || false);
  const [discoveryEnabled, setDiscoveryEnabled] = useState(profile?.default_discovery_enabled ?? true);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('soundEnabled') !== 'false';
  });
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('soundEnabled', String(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    if (isOpen && profile) {
      setUsername(profile.username || '');
      setDisplayName(profile.display_name || '');
      setBio(profile.bio || '');
      setIsPrivate(profile.is_private || false);
      setDiscoveryEnabled(profile.default_discovery_enabled ?? true);
      setError(null);
      setSuccess(null);
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    try {
      if (username !== profile?.username) {
        await updateUsername(username);
      }
      
      await updateProfile({
        display_name: displayName,
        bio,
        is_private: isPrivate,
        default_discovery_enabled: discoveryEnabled
      });
      
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to update profile');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setError(null);
    try {
      await uploadAvatar(file);
      setSuccess('Avatar updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to upload avatar');
    }
  };

  const handleDeleteAvatar = async () => {
    setError(null);
    try {
      await deleteAvatar();
      setSuccess('Avatar removed successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to remove avatar');
    }
  };

  const isSaving = isUpdatingProfile || isUpdatingUsername;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-lg font-semibold">Settings</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-2 border-muted">
                {profile?.avatar ? (
                  <AvatarImage src={profile.avatar.url} className="object-cover" />
                ) : null}
                <AvatarFallback className="text-2xl">
                  {(profile?.display_name || profile?.username || profile?.email || '?')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-full text-white hover:text-white hover:bg-white/20"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                >
                  {isUploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </Button>
                {profile?.avatar && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full text-red-400 hover:text-red-400 hover:bg-white/20"
                    onClick={handleDeleteAvatar}
                    disabled={isDeletingAvatar}
                  >
                    {isDeletingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                )}
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="text-center">
              <h3 className="font-medium text-lg">{profile?.display_name || profile?.username || 'User'}</h3>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                placeholder="Choose a unique username"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input 
                id="displayName" 
                value={displayName} 
                onChange={(e) => setDisplayName(e.target.value)} 
                placeholder="How others see you"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <textarea 
                id="bio" 
                value={bio} 
                onChange={(e) => setBio(e.target.value)} 
                placeholder="A little about yourself"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Privacy</h4>
              
              <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Private Account</div>
                  <div className="text-xs text-muted-foreground">Only approved users can message you</div>
                </div>
                <div className={cn(
                  "w-10 h-6 rounded-full transition-colors relative",
                  isPrivate ? "bg-primary" : "bg-muted-foreground/30"
                )}>
                  <div className={cn(
                    "absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform",
                    isPrivate ? "translate-x-4" : "translate-x-0"
                  )} />
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={isPrivate} 
                  onChange={(e) => setIsPrivate(e.target.checked)} 
                />
              </label>
              
              <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Discoverable</div>
                  <div className="text-xs text-muted-foreground">Allow others to find you by username</div>
                </div>
                <div className={cn(
                  "w-10 h-6 rounded-full transition-colors relative",
                  discoveryEnabled ? "bg-primary" : "bg-muted-foreground/30"
                )}>
                  <div className={cn(
                    "absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform",
                    discoveryEnabled ? "translate-x-4" : "translate-x-0"
                  )} />
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={discoveryEnabled} 
                  onChange={(e) => setDiscoveryEnabled(e.target.checked)} 
                />
              </label>
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Notifications</h4>
              
              <label className="flex items-center justify-between cursor-pointer p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">Sound Notifications</div>
                  <div className="text-xs text-muted-foreground">Play a sound when a new message is received</div>
                </div>
                <div className={cn(
                  "w-10 h-6 rounded-full transition-colors relative",
                  soundEnabled ? "bg-primary" : "bg-muted-foreground/30"
                )}>
                  <div className={cn(
                    "absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform",
                    soundEnabled ? "translate-x-4" : "translate-x-0"
                  )} />
                </div>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={soundEnabled} 
                  onChange={(e) => setSoundEnabled(e.target.checked)} 
                />
              </label>
            </div>
          </div>

          {error && <div className="text-sm text-red-500 bg-red-500/10 p-3 rounded-md">{error}</div>}
          {success && <div className="text-sm text-green-500 bg-green-500/10 p-3 rounded-md">{success}</div>}
        </div>
        
        <div className="p-4 border-t bg-muted/20 shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
