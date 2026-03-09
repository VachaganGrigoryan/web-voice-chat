export const SUPPORTED_AUDIO_MIMES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/webm', 'audio/ogg'
];
export const SUPPORTED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
export const SUPPORTED_STICKER_MIMES = ['image/png', 'image/webp'];
export const SUPPORTED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'];

export const getMessageType = (file: File): 'voice' | 'image' | 'sticker' | 'video' | null => {
  if (SUPPORTED_AUDIO_MIMES.includes(file.type)) return 'voice';
  if (SUPPORTED_IMAGE_MIMES.includes(file.type)) return 'image';
  if (SUPPORTED_VIDEO_MIMES.includes(file.type)) return 'video';
  return null;
};

export const validateFile = (file: File, isSticker: boolean = false): string | null => {
  const MAX_STICKER_SIZE = 2 * 1024 * 1024; // 2MB
  
  if (isSticker) {
    if (!SUPPORTED_STICKER_MIMES.includes(file.type)) return 'Unsupported sticker type';
    if (file.size > MAX_STICKER_SIZE) return 'Sticker size exceeds 2MB';
    return null;
  }

  if (
    !SUPPORTED_AUDIO_MIMES.includes(file.type) &&
    !SUPPORTED_IMAGE_MIMES.includes(file.type) &&
    !SUPPORTED_VIDEO_MIMES.includes(file.type)
  ) {
    return 'Unsupported file type';
  }
  
  return null;
};
