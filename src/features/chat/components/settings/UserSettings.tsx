import React, { useState, useRef, useEffect } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { X, Camera, Trash2, Loader2, Save, Volume2, Monitor, Moon, Sun, Palette, User, Shield, KeyRound, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { unlockAudioExplicit } from '@/utils/notificationSound';
import { useTheme } from '@/components/ThemeProvider';
import PasskeysSettings from '@/features/settings/PasskeysSettings';

import DiscoverySettings from '@/features/settings/DiscoverySettings';

interface UserSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'profile' | 'appearance' | 'privacy' | 'passkeys' | 'discovery';

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

  const { mode, setMode, theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<TabType>('profile');
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
      const errorData = err.response?.data?.error;
      const message = typeof errorData === 'string' ? errorData : errorData?.message || 'Failed to update profile';
      setError(message);
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
      const errorData = err.response?.data?.error;
      const message = typeof errorData === 'string' ? errorData : errorData?.message || 'Failed to upload avatar';
      setError(message);
    }
  };

  const handleDeleteAvatar = async () => {
    setError(null);
    try {
      await deleteAvatar();
      setSuccess('Avatar removed successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const errorData = err.response?.data?.error;
      const message = typeof errorData === 'string' ? errorData : errorData?.message || 'Failed to remove avatar';
      setError(message);
    }
  };

  const isSaving = isUpdatingProfile || isUpdatingUsername;

  const TabButton = ({ icon, label, id }: { icon: React.ReactNode, label: string, id: TabType }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 rounded-full md:rounded-lg transition-all whitespace-nowrap text-sm font-medium",
        activeTab === id 
          ? "bg-primary text-primary-foreground shadow-sm" 
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col md:flex-row animate-in fade-in duration-200">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b shrink-0 bg-background/80 backdrop-blur-md z-10">
        <h2 className="text-lg font-semibold">Settings</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Sidebar (Desktop) & Top Scrollable Tabs (Mobile) */}
      <div className="flex md:flex-col border-b md:border-b-0 md:border-r w-full md:w-64 lg:w-72 shrink-0 overflow-x-auto md:overflow-y-auto no-scrollbar bg-muted/10 md:bg-muted/30 p-3 md:p-4 gap-2 z-10">
        <div className="hidden md:flex items-center justify-between px-2 pb-4 pt-2">
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        </div>
        <div className="flex md:flex-col gap-2">
          <TabButton id="profile" icon={<User className="h-4 w-4" />} label="Profile" />
          <TabButton id="appearance" icon={<Palette className="h-4 w-4" />} label="Appearance" />
          <TabButton id="privacy" icon={<Shield className="h-4 w-4" />} label="Privacy" />
          <TabButton id="passkeys" icon={<KeyRound className="h-4 w-4" />} label="Passkeys" />
          <TabButton id="discovery" icon={<User className="h-4 w-4" />} label="Discovery" />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative bg-background">
        {/* Desktop Close Button */}
        <div className="hidden md:flex absolute top-6 right-6 z-10">
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-muted/50 hover:bg-muted">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 w-full max-w-3xl mx-auto">
          <div className="space-y-8 pb-20 md:pb-0">
            <h3 className="text-2xl font-semibold hidden md:block capitalize tracking-tight">{activeTab}</h3>
            
            {error && <div className="text-sm text-destructive bg-destructive/10 p-4 rounded-lg animate-in fade-in">{error}</div>}
            {success && <div className="text-sm text-green-500 bg-green-500/10 p-4 rounded-lg animate-in fade-in">{success}</div>}

            {activeTab === 'profile' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Avatar Section */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  <div className="relative group shrink-0">
                    <Avatar className="h-28 w-28 border-4 border-background shadow-sm">
                      {profile?.avatar ? (
                        <AvatarImage src={profile.avatar.url} className="object-cover" />
                      ) : null}
                      <AvatarFallback className="text-3xl bg-muted">
                        {(profile?.display_name || profile?.username || profile?.email || '?')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-9 w-9 rounded-full text-white hover:text-white hover:bg-white/20"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                      >
                        {isUploadingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      </Button>
                      {profile?.avatar && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-full text-red-400 hover:text-red-400 hover:bg-white/20"
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
                  <div className="text-center sm:text-left space-y-1 pt-2">
                    <h3 className="font-semibold text-xl">{profile?.display_name || profile?.username || 'User'}</h3>
                    <p className="text-sm text-muted-foreground">{profile?.email}</p>
                    <p className="text-xs text-muted-foreground pt-2 max-w-xs">
                      Update your photo and personal details here.
                    </p>
                  </div>
                </div>

                <div className="space-y-5 max-w-xl">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input 
                      id="username" 
                      value={username} 
                      onChange={(e) => setUsername(e.target.value)} 
                      placeholder="Choose a unique username"
                      className="max-w-md"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input 
                      id="displayName" 
                      value={displayName} 
                      onChange={(e) => setDisplayName(e.target.value)} 
                      placeholder="How others see you"
                      className="max-w-md"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <textarea 
                      id="bio" 
                      value={bio} 
                      onChange={(e) => setBio(e.target.value)} 
                      placeholder="A little about yourself"
                      className="flex min-h-[100px] w-full max-w-md rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300 max-w-xl">
                <div className="space-y-4">
                  <div>
                    <Label className="text-base">Theme Mode</Label>
                    <p className="text-sm text-muted-foreground mb-4">Select or customize your UI theme.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Button
                      variant={mode === 'light' ? 'default' : 'outline'}
                      className="w-full h-12"
                      onClick={() => setMode('light')}
                    >
                      <Sun className="h-4 w-4 mr-2" />
                      Light
                    </Button>
                    <Button
                      variant={mode === 'dark' ? 'default' : 'outline'}
                      className="w-full h-12"
                      onClick={() => setMode('dark')}
                    >
                      <Moon className="h-4 w-4 mr-2" />
                      Dark
                    </Button>
                    <Button
                      variant={mode === 'system' ? 'default' : 'outline'}
                      className="w-full h-12"
                      onClick={() => setMode('system')}
                    >
                      <Monitor className="h-4 w-4 mr-2" />
                      System
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label className="text-base">Color Theme</Label>
                    <p className="text-sm text-muted-foreground mb-4">Choose your preferred accent color.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Button
                      variant={theme === 'default' ? 'default' : 'outline'}
                      className="w-full justify-start h-12"
                      onClick={() => setTheme('default')}
                    >
                      <div className="w-4 h-4 rounded-full bg-zinc-900 dark:bg-zinc-100 mr-3" />
                      Default (Zinc)
                    </Button>
                    <Button
                      variant={theme === 'slate' ? 'default' : 'outline'}
                      className="w-full justify-start h-12"
                      onClick={() => setTheme('slate')}
                    >
                      <div className="w-4 h-4 rounded-full bg-slate-900 dark:bg-slate-100 mr-3" />
                      Slate
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300 max-w-xl">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-base font-medium">Account Privacy</h4>
                    <p className="text-sm text-muted-foreground mb-4">Manage who can see and interact with you.</p>
                  </div>
                  
                  <label className="flex items-center justify-between cursor-pointer p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors shadow-sm">
                    <div className="space-y-1 pr-4">
                      <div className="text-sm font-medium">Private Account</div>
                      <div className="text-sm text-muted-foreground">Only approved users can message you</div>
                    </div>
                    <div className={cn(
                      "w-11 h-6 rounded-full transition-colors relative shrink-0",
                      isPrivate ? "bg-primary" : "bg-muted border"
                    )}>
                      <div className={cn(
                        "absolute top-0.5 left-0.5 bg-background w-5 h-5 rounded-full transition-transform shadow-sm",
                        isPrivate ? "translate-x-5" : "translate-x-0"
                      )} />
                    </div>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={isPrivate} 
                      onChange={(e) => setIsPrivate(e.target.checked)} 
                    />
                  </label>
                  
                  <label className="flex items-center justify-between cursor-pointer p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors shadow-sm">
                    <div className="space-y-1 pr-4">
                      <div className="text-sm font-medium">Discoverable</div>
                      <div className="text-sm text-muted-foreground">Allow others to find you by username</div>
                    </div>
                    <div className={cn(
                      "w-11 h-6 rounded-full transition-colors relative shrink-0",
                      discoveryEnabled ? "bg-primary" : "bg-muted border"
                    )}>
                      <div className={cn(
                        "absolute top-0.5 left-0.5 bg-background w-5 h-5 rounded-full transition-transform shadow-sm",
                        discoveryEnabled ? "translate-x-5" : "translate-x-0"
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

                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <h4 className="text-base font-medium">Notifications</h4>
                    <p className="text-sm text-muted-foreground mb-4">Manage your notification preferences.</p>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start h-12 bg-card shadow-sm" 
                    onClick={async () => {
                      const success = await unlockAudioExplicit();
                      if (success) {
                        setSuccess('Sound enabled successfully');
                        setTimeout(() => setSuccess(null), 3000);
                      } else {
                        setError('Failed to enable sound. Please try clicking again.');
                        setTimeout(() => setError(null), 3000);
                      }
                    }}
                  >
                    <Volume2 className="h-4 w-4 mr-3 text-muted-foreground" />
                    Test & Enable Sound Notifications
                  </Button>

                  <label className="flex items-center justify-between cursor-pointer p-4 rounded-xl border bg-card hover:bg-accent/50 transition-colors shadow-sm">
                    <div className="space-y-1 pr-4">
                      <div className="text-sm font-medium">Sound Notifications</div>
                      <div className="text-sm text-muted-foreground">Play a sound when a new message is received</div>
                    </div>
                    <div className={cn(
                      "w-11 h-6 rounded-full transition-colors relative shrink-0",
                      soundEnabled ? "bg-primary" : "bg-muted border"
                    )}>
                      <div className={cn(
                        "absolute top-0.5 left-0.5 bg-background w-5 h-5 rounded-full transition-transform shadow-sm",
                        soundEnabled ? "translate-x-5" : "translate-x-0"
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
            )}

            {activeTab === 'passkeys' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-2xl">
                <PasskeysSettings />
              </div>
            )}

            {activeTab === 'discovery' && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-2xl">
                <DiscoverySettings />
              </div>
            )}
          </div>
        </div>
        
        {/* Footer Actions */}
        {(activeTab === 'profile' || activeTab === 'privacy') && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background/80 backdrop-blur-md flex justify-end gap-3 z-20">
            <Button variant="outline" onClick={onClose} className="md:hidden">Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="w-full md:w-auto shadow-sm">
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
