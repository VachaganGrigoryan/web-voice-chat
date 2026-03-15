import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/endpoints';
import { User } from '@/api/types';

export function useProfile() {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await usersApi.getMe();
      return response.data.data;
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { display_name?: string; bio?: string; is_private?: boolean; default_discovery_enabled?: boolean }) => {
      const response = await usersApi.updateProfile(data);
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data);
    },
  });

  const updateUsernameMutation = useMutation({
    mutationFn: async (username: string) => {
      const response = await usersApi.updateUsername(username);
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data);
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await usersApi.uploadAvatar(formData);
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data);
    },
  });

  const deleteAvatarMutation = useMutation({
    mutationFn: async () => {
      const response = await usersApi.deleteAvatar();
      return response.data.data;
    },
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
