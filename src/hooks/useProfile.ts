import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/endpoints';

export function useProfile() {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => usersApi.getMe(),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: { display_name?: string; bio?: string; is_private?: boolean; default_discovery_enabled?: boolean }) =>
      usersApi.updateProfile(data),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data);
    },
  });

  const updateUsernameMutation = useMutation({
    mutationFn: (username: string) => usersApi.updateUsername(username),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data);
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return usersApi.uploadAvatar(formData);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data);
    },
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: () => usersApi.deleteAvatar(),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data);
    },
  });

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    updateProfile: updateProfileMutation.mutateAsync,
    isUpdatingProfile: updateProfileMutation.isPending,
    updateUsername: updateUsernameMutation.mutateAsync,
    isUpdatingUsername: updateUsernameMutation.isPending,
    uploadAvatar: uploadAvatarMutation.mutateAsync,
    isUploadingAvatar: uploadAvatarMutation.isPending,
    deleteAvatar: deleteAvatarMutation.mutateAsync,
    isDeletingAvatar: deleteAvatarMutation.isPending,
  };
}
