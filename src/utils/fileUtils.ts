export const SUPPORTED_AUDIO_MIMES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/webm', 'audio/ogg'
];
export const SUPPORTED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
export const SUPPORTED_STICKER_MIMES = ['image/png', 'image/webp'];
export const SUPPORTED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const SUPPORTED_DOCUMENT_MIMES = [
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-7z-compressed',
  'application/vnd.rar',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
export const SUPPORTED_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.txt',
  '.csv',
  '.json',
  '.zip',
  '.7z',
  '.rar',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
];
export const SUPPORTED_FILE_MIMES = Array.from(
  new Set([
    ...SUPPORTED_AUDIO_MIMES,
    ...SUPPORTED_IMAGE_MIMES,
    ...SUPPORTED_VIDEO_MIMES,
    ...SUPPORTED_DOCUMENT_MIMES,
  ])
);
export const FILE_ATTACH_ACCEPT = [
  ...SUPPORTED_FILE_MIMES,
  ...SUPPORTED_DOCUMENT_EXTENSIONS,
].join(',');
export const MEDIA_ATTACH_ACCEPT = 'image/*,video/*';

export type AttachmentMode = 'media' | 'file';

const normalizeMimeType = (mimeType: string) => mimeType.split(';')[0]?.trim().toLowerCase() || '';

export const isSupportedVideoMime = (mimeType: string) =>
  SUPPORTED_VIDEO_MIMES.includes(normalizeMimeType(mimeType));

export const getSupportedVideoMime = (mimeType: string) => {
  const normalizedMimeType = normalizeMimeType(mimeType);
  return isSupportedVideoMime(normalizedMimeType) ? normalizedMimeType : null;
};

const hasSupportedDocumentExtension = (fileName: string) => {
  const lowerName = fileName.toLowerCase();
  return SUPPORTED_DOCUMENT_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
};

const isSupportedFileAttachment = (file: File) =>
  SUPPORTED_FILE_MIMES.includes(file.type) ||
  hasSupportedDocumentExtension(file.name);

export const getMessageType = (file: File): 'voice' | 'image' | 'sticker' | 'video' | null => {
  if (SUPPORTED_AUDIO_MIMES.includes(file.type)) return 'voice';
  if (SUPPORTED_IMAGE_MIMES.includes(file.type)) return 'image';
  if (isSupportedVideoMime(file.type)) return 'video';
  return null;
};

export const getAttachmentMessageType = (
  file: File,
  mode: AttachmentMode
): 'image' | 'video' | 'file' | null => {
  if (mode === 'media') {
    const mediaType = getMessageType(file);
    return mediaType === 'image' || mediaType === 'video' ? mediaType : null;
  }

  return isSupportedFileAttachment(file) ? 'file' : null;
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
    !isSupportedVideoMime(file.type)
  ) {
    return 'Unsupported file type';
  }
  
  return null;
};

export const validateAttachmentFile = (file: File, mode: AttachmentMode): string | null => {
  if (mode === 'media') {
    const validationError = validateFile(file);
    if (validationError) {
      return validationError;
    }

    const type = getAttachmentMessageType(file, mode);
    return type ? null : 'Only images and videos can be attached in media mode';
  }

  return isSupportedFileAttachment(file) ? null : 'Unsupported file type';
};
