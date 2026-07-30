import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { extractApiError } from '@/api/errors';
import { useProfile } from '@/hooks/useProfile';

/**
 * Owns identity-editing state. Previously this lived inside SettingsPage and was
 * prop-drilled 24 levels wide; profile editing is not a setting, so the state
 * travels with the form instead of with the settings shell.
 */
export function useProfileEditor() {
  const {
    profile,
    updateProfile,
    updateUsername,
    uploadAvatar,
    deleteAvatar,
    isUpdatingProfile,
    isUpdatingUsername,
    isUploadingAvatar,
    isDeletingAvatar,
    updateStatus,
    clearStatus,
    isUpdatingStatus,
    isClearingStatus,
  } = useProfile();

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [timezone, setTimezone] = useState('');
  const [statusEmoji, setStatusEmoji] = useState('');
  const [statusText, setStatusText] = useState('');
  const [statusExpiresAt, setStatusExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!profile) return;

    setUsername(profile.username || '');
    setDisplayName(profile.display_name || '');
    setBio(profile.bio || '');
    setPronouns(profile.pronouns || '');
    setTimezone(profile.timezone || '');
    setStatusEmoji(profile.status_emoji || '');
    setStatusText(profile.status_text || '');
    setStatusExpiresAt(profile.status_expires_at ? profile.status_expires_at.slice(0, 16) : '');
  }, [profile]);

  const flashSuccess = (message: string) => {
    setSuccess(message);
    window.setTimeout(() => setSuccess(null), 3000);
  };

  const run = async (action: () => Promise<unknown>, successMessage: string, fallback: string) => {
    setError(null);
    setSuccess(null);
    try {
      await action();
      flashSuccess(successMessage);
    } catch (err) {
      setError(extractApiError(err, fallback));
    }
  };

  const handleSave = () =>
    run(
      async () => {
        if (username !== (profile?.username || '')) {
          await updateUsername(username);
        }
        await updateProfile({ display_name: displayName, bio, pronouns, timezone });
      },
      'Profile updated successfully.',
      'Failed to update profile'
    );

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await run(() => uploadAvatar(file), 'Avatar updated successfully.', 'Failed to upload avatar');
    } finally {
      event.target.value = '';
    }
  };

  const handleDeleteAvatar = () =>
    run(() => deleteAvatar(), 'Avatar removed successfully.', 'Failed to remove avatar');

  const handleUpdateStatus = () =>
    run(
      () =>
        updateStatus({
          status_emoji: statusEmoji,
          status_text: statusText,
          status_expires_at: statusExpiresAt ? new Date(statusExpiresAt).toISOString() : null,
        }),
      'Status updated successfully.',
      'Failed to update status'
    );

  const handleClearStatus = () =>
    run(
      async () => {
        await clearStatus();
        setStatusEmoji('');
        setStatusText('');
        setStatusExpiresAt('');
      },
      'Status cleared successfully.',
      'Failed to clear status'
    );

  return {
    profile,
    username,
    setUsername,
    displayName,
    setDisplayName,
    bio,
    setBio,
    pronouns,
    setPronouns,
    timezone,
    setTimezone,
    statusEmoji,
    setStatusEmoji,
    statusText,
    setStatusText,
    statusExpiresAt,
    setStatusExpiresAt,
    fileInputRef,
    error,
    success,
    handleSave,
    handleAvatarUpload,
    handleDeleteAvatar,
    handleUpdateStatus,
    handleClearStatus,
    isSaving: isUpdatingProfile || isUpdatingUsername,
    isUploadingAvatar,
    isDeletingAvatar,
    isUpdatingStatus,
    isClearingStatus,
  };
}
