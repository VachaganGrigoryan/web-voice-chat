export const SUPPORTED_AUDIO_MIMES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/webm',
  'audio/ogg',
  'audio/amr',
  'audio/3gpp',
  'audio/flac',
];

export const SUPPORTED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
export const SUPPORTED_STICKER_MIMES = ['image/png', 'image/webp'];
export const SUPPORTED_VIDEO_MIMES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/3gpp',
];
export const SUPPORTED_DOCUMENT_MIMES = [
  'text/plain',
  'text/csv',
  'application/pdf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
export const SUPPORTED_ARCHIVE_MIMES = [
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
  'application/gzip',
  'application/x-gzip',
  'application/x-tar',
];
export const SUPPORTED_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.txt',
  '.csv',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
];
export const SUPPORTED_ARCHIVE_EXTENSIONS = ['.zip', '.rar', '.7z', '.gz', '.tgz', '.tar'];

export const SUPPORTED_FILE_MIMES = Array.from(
  new Set([
    ...SUPPORTED_AUDIO_MIMES,
    ...SUPPORTED_IMAGE_MIMES,
    ...SUPPORTED_VIDEO_MIMES,
    ...SUPPORTED_DOCUMENT_MIMES,
    ...SUPPORTED_ARCHIVE_MIMES,
  ])
);

export const FILE_ATTACH_ACCEPT = [
  ...SUPPORTED_FILE_MIMES,
  ...SUPPORTED_DOCUMENT_EXTENSIONS,
  ...SUPPORTED_ARCHIVE_EXTENSIONS,
].join(',');
export const MEDIA_ATTACH_ACCEPT = 'image/*,video/*';

export type AttachmentMode = 'media' | 'file';
export type AttachmentUploadKind = 'image' | 'video' | 'file';

export const MAX_PREVIEW_MEDIA_BYTES = 10 * 1024 * 1024;
export const MAX_GENERIC_FILE_BYTES = 25 * 1024 * 1024;

const normalizeMimeType = (mimeType: string) => mimeType.split(';')[0]?.trim().toLowerCase() || '';

export const isSupportedVideoMime = (mimeType: string) =>
  SUPPORTED_VIDEO_MIMES.includes(normalizeMimeType(mimeType));

export const getSupportedVideoMime = (mimeType: string) => {
  const normalizedMimeType = normalizeMimeType(mimeType);
  return isSupportedVideoMime(normalizedMimeType) ? normalizedMimeType : null;
};

const hasSupportedFileExtension = (fileName: string) => {
  const lowerName = fileName.toLowerCase();
  return (
    SUPPORTED_DOCUMENT_EXTENSIONS.some((extension) => lowerName.endsWith(extension)) ||
    SUPPORTED_ARCHIVE_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
  );
};

const isSupportedFileAttachment = (file: File) =>
  SUPPORTED_FILE_MIMES.includes(normalizeMimeType(file.type)) || hasSupportedFileExtension(file.name);

export const getAttachmentMessageType = (
  file: File,
  mode: AttachmentMode
): AttachmentUploadKind | null => {
  const normalizedMimeType = normalizeMimeType(file.type);

  if (mode === 'media') {
    if (SUPPORTED_IMAGE_MIMES.includes(normalizedMimeType)) return 'image';
    if (isSupportedVideoMime(normalizedMimeType)) return 'video';
    return null;
  }

  return isSupportedFileAttachment(file) ? 'file' : null;
};

export const validateFile = (file: File, isSticker: boolean = false): string | null => {
  const MAX_STICKER_SIZE = 2 * 1024 * 1024;
  const normalizedMimeType = normalizeMimeType(file.type);

  if (isSticker) {
    if (!SUPPORTED_STICKER_MIMES.includes(normalizedMimeType)) return 'Unsupported sticker type';
    if (file.size > MAX_STICKER_SIZE) return 'Sticker size exceeds 2MB';
    return null;
  }

  if (
    !SUPPORTED_AUDIO_MIMES.includes(normalizedMimeType) &&
    !SUPPORTED_IMAGE_MIMES.includes(normalizedMimeType) &&
    !isSupportedVideoMime(normalizedMimeType)
  ) {
    return 'Unsupported file type';
  }

  if (file.size > MAX_PREVIEW_MEDIA_BYTES) {
    return 'Media size exceeds 10MB';
  }

  return null;
};

export const validateAttachmentFile = (file: File, mode: AttachmentMode): string | null => {
  if (mode === 'media') {
    const attachmentType = getAttachmentMessageType(file, mode);
    if (!attachmentType) {
      return 'Only images and videos can be attached in media mode';
    }

    if (file.size > MAX_PREVIEW_MEDIA_BYTES) {
      return 'Media size exceeds 10MB';
    }

    return null;
  }

  if (!isSupportedFileAttachment(file)) {
    return 'Unsupported file type';
  }

  if (file.size > MAX_GENERIC_FILE_BYTES) {
    return 'File size exceeds 25MB';
  }

  return null;
};
