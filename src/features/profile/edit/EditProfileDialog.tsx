import { Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import ProfileSettingsTab from '@/features/settings/tabs/ProfileSettingsTab';
import { useProfileEditor } from './useProfileEditor';

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Identity editing, reached from the user's own profile rather than from Settings.
 * The form itself is the existing ProfileSettingsTab, now fed by useProfileEditor.
 */
export function EditProfileDialog({ open, onOpenChange }: EditProfileDialogProps) {
  const editor = useProfileEditor();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Your name, username, bio and current status.
          </DialogDescription>
        </DialogHeader>

        {editor.error ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {editor.error}
          </div>
        ) : null}
        {editor.success ? (
          <div className="rounded-2xl border border-presence-online/25 bg-presence-online/10 px-4 py-3 text-sm text-presence-online">
            {editor.success}
          </div>
        ) : null}

        <ProfileSettingsTab
          profile={editor.profile}
          username={editor.username}
          setUsername={editor.setUsername}
          displayName={editor.displayName}
          setDisplayName={editor.setDisplayName}
          bio={editor.bio}
          setBio={editor.setBio}
          pronouns={editor.pronouns}
          setPronouns={editor.setPronouns}
          timezone={editor.timezone}
          setTimezone={editor.setTimezone}
          statusEmoji={editor.statusEmoji}
          setStatusEmoji={editor.setStatusEmoji}
          statusText={editor.statusText}
          setStatusText={editor.setStatusText}
          statusExpiresAt={editor.statusExpiresAt}
          setStatusExpiresAt={editor.setStatusExpiresAt}
          handleUpdateStatus={editor.handleUpdateStatus}
          handleClearStatus={editor.handleClearStatus}
          fileInputRef={editor.fileInputRef}
          handleAvatarUpload={editor.handleAvatarUpload}
          handleDeleteAvatar={editor.handleDeleteAvatar}
          isUploadingAvatar={editor.isUploadingAvatar}
          isDeletingAvatar={editor.isDeletingAvatar}
          isUpdatingStatus={editor.isUpdatingStatus}
          isClearingStatus={editor.isClearingStatus}
        />

        <DialogFooter>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            className="cursor-pointer gap-2 bg-brand text-brand-foreground hover:bg-brand/90"
            disabled={editor.isSaving}
            onClick={() => void editor.handleSave()}
          >
            {editor.isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
