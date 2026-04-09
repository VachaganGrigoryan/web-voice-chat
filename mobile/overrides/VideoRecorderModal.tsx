import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';
import {
  AlertCircle,
  Camera,
  Loader2,
  RotateCcw,
  Send,
  Video,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { getSupportedVideoMime } from '@/utils/fileUtils';
import type { ComposerReplyTarget } from '@/features/chat/types/message';
import WebVideoRecorderModal from '@/features/chat/media/recorders/VideoRecorderModal';
import {
  androidVideoRecorder,
  type AndroidVideoRecording,
} from '../plugins/androidVideoRecorder';

const HARD_MAX_VIDEO_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_DURATION_MS = 90_000;

interface VideoRecorderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiverId: string;
  onSendVideo: (data: {
    type: 'media';
    media_kind: 'video';
    receiver_id: string;
    file: File;
    text?: string;
    duration_ms?: number;
    reply_mode?: ComposerReplyTarget['mode'] | null;
    reply_to_message_id?: string;
  }) => Promise<any>;
  replyTarget?: ComposerReplyTarget | null;
  onClearReplyTarget?: () => void;
}

const isNativeAndroid =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const isCancelledError = (error: unknown) =>
  error instanceof Error && /cancel/i.test(error.message);

const getExtensionFromMimeType = (mimeType: string) => {
  if (mimeType.includes('quicktime')) return 'mov';
  if (mimeType.includes('3gpp')) return '3gp';
  if (mimeType.includes('webm')) return 'webm';
  return 'mp4';
};

const formatDuration = (durationMs: number) => {
  const durationSec = Math.max(1, Math.round(durationMs / 1000));
  const mins = Math.floor(durationSec / 60);
  const secs = durationSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const blobFromBase64 = (base64: string, mimeType: string) => {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
};

const readRecordedVideoBlob = async (recording: AndroidVideoRecording) => {
  const webPath = Capacitor.convertFileSrc(recording.uri);

  try {
    const response = await fetch(webPath);
    if (!response.ok) {
      throw new Error(`Failed to read recorded video: ${response.status}`);
    }

    return await response.blob();
  } catch (error) {
    const fileResult = await Filesystem.readFile({
      path: recording.uri,
    });
    return blobFromBase64(fileResult.data as string, recording.mimeType);
  }
};

export default function MobileVideoRecorderModal(props: VideoRecorderModalProps) {
  if (!isNativeAndroid || !androidVideoRecorder.isNativeAndroid) {
    return <WebVideoRecorderModal {...props} />;
  }

  const {
    open,
    onOpenChange,
    receiverId,
    onSendVideo,
    replyTarget,
    onClearReplyTarget,
  } = props;
  const [isLaunchingRecorder, setIsLaunchingRecorder] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordedVideo, setRecordedVideo] = useState<AndroidVideoRecording | null>(null);
  const launchTokenRef = useRef(0);

  const previewUrl = useMemo(
    () => (recordedVideo ? Capacitor.convertFileSrc(recordedVideo.uri) : null),
    [recordedVideo],
  );

  const resetModalState = () => {
    setError(null);
    setRecordedVideo(null);
    setIsLaunchingRecorder(false);
    setIsSending(false);
  };

  const closeModal = () => {
    if (isSending) {
      return;
    }

    launchTokenRef.current += 1;
    resetModalState();
    onOpenChange(false);
  };

  const sendRecording = async (
    recording: AndroidVideoRecording,
    token: number,
    options: { keepPreviewOnFailure: boolean },
  ) => {
    setIsSending(true);
    setError(null);

    try {
      const blob = await readRecordedVideoBlob(recording);
      const mimeType = getSupportedVideoMime(recording.mimeType) || 'video/mp4';
      const file = new File(
        [blob],
        `video-message.${getExtensionFromMimeType(mimeType)}`,
        { type: mimeType },
      );

      await onSendVideo({
        type: 'media',
        media_kind: 'video',
        receiver_id: receiverId,
        file,
        duration_ms: Math.max(1_000, recording.durationMs),
        reply_mode: replyTarget?.mode,
        reply_to_message_id: replyTarget?.messageId,
      });

      if (token !== launchTokenRef.current) {
        return;
      }

      onClearReplyTarget?.();
      resetModalState();
      onOpenChange(false);
    } catch (caughtError) {
      console.error('Failed to send native recorded video:', caughtError);

      if (token !== launchTokenRef.current) {
        return;
      }

      if (options.keepPreviewOnFailure) {
        setRecordedVideo(recording);
      }
      setError('The recorded video could not be uploaded. Review it here and try again.');
    } finally {
      if (token === launchTokenRef.current) {
        setIsSending(false);
      }
    }
  };

  const launchRecorder = async () => {
    setIsLaunchingRecorder(true);
    setError(null);
    setRecordedVideo(null);
    const token = ++launchTokenRef.current;

    try {
      let permissions = await androidVideoRecorder.checkPermissions();
      if (permissions.camera !== 'granted' || permissions.microphone !== 'granted') {
        permissions = await androidVideoRecorder.requestPermissions();
      }

      if (permissions.camera !== 'granted' || permissions.microphone !== 'granted') {
        setError('Camera and microphone permissions are required to record video messages.');
        return;
      }

      const recording = await androidVideoRecorder.record({
        maxDurationMs: MAX_DURATION_MS,
        maxFileSizeBytes: HARD_MAX_VIDEO_SIZE_BYTES,
        preferredCamera: 'front',
        replyMode: replyTarget?.mode,
        replySenderLabel: replyTarget?.senderLabel,
        replyPreviewText: replyTarget?.previewText,
      });

      if (token !== launchTokenRef.current) {
        return;
      }

      if (recording.sizeBytes > HARD_MAX_VIDEO_SIZE_BYTES) {
        setError('Recording exceeded the 10 MB upload limit.');
        return;
      }

      await sendRecording(recording, token, { keepPreviewOnFailure: true });
    } catch (caughtError) {
      if (token !== launchTokenRef.current) {
        return;
      }

      if (isCancelledError(caughtError)) {
        closeModal();
        return;
      }

      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'The native recorder could not finish the video capture.';
      setError(message);
    } finally {
      if (token === launchTokenRef.current) {
        setIsLaunchingRecorder(false);
      }
    }
  };

  const handleSend = async () => {
    if (!recordedVideo || isSending) {
      return;
    }

    await sendRecording(recordedVideo, launchTokenRef.current, { keepPreviewOnFailure: true });
  };

  useEffect(() => {
    if (!open) {
      launchTokenRef.current += 1;
      resetModalState();
      return;
    }

    if (!recordedVideo && !isLaunchingRecorder && !isSending) {
      void launchRecorder();
    }
  }, [open, recordedVideo, isLaunchingRecorder, isSending]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          closeModal();
          return;
        }

        onOpenChange(true);
      }}
    >
      <DialogPortal>
        <DialogOverlay className="bg-black/75 backdrop-blur-sm" />
        <DialogContent
          className="z-[70] [&>button]:hidden fixed inset-0 left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-black p-0 shadow-none md:left-[50%] md:top-[50%] md:h-[min(94vh,58rem)] md:w-[min(88rem,calc(100vw-2rem))] md:max-w-[88rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[34px] md:border md:border-white/10 md:shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-white">
            <div>
              <DialogTitle className="text-base font-semibold text-white">
                Video message
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-white/60">
                Native Android capture with chat review before send.
              </DialogDescription>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-10 w-10 rounded-full text-white hover:bg-white/10"
              onClick={closeModal}
              disabled={isSending}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            {isLaunchingRecorder ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-white">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/8">
                  <Loader2 className="h-8 w-8 animate-spin text-white/80" />
                </div>
                <div>
                  <div className="text-lg font-medium">Opening native recorder</div>
                  <div className="mt-2 max-w-md text-sm text-white/60">
                    The Android camera opens in a separate screen with live capture, review,
                    and retake. When you confirm the clip there, the app will finish uploading it here.
                  </div>
                </div>
              </div>
            ) : isSending && !recordedVideo ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center text-white">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/8">
                  <Loader2 className="h-8 w-8 animate-spin text-white/80" />
                </div>
                <div>
                  <div className="text-lg font-medium">Sending video</div>
                  <div className="mt-2 max-w-md text-sm text-white/60">
                    Finalizing the native recording and uploading it to the chat.
                  </div>
                </div>
              </div>
            ) : recordedVideo && previewUrl ? (
              <>
                <div className="relative flex-1 bg-slate-950">
                  <video
                    src={previewUrl}
                    controls
                    autoPlay
                    playsInline
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-white/10 px-5 py-4 text-white">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">Recorded clip</div>
                    <div className="mt-1 text-sm text-white/60">
                      {formatDuration(recordedVideo.durationMs)} ·{' '}
                      {formatFileSize(recordedVideo.sizeBytes)}
                    </div>
                    {error ? (
                      <div className="mt-2 text-sm text-amber-300">{error}</div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => void launchRecorder()}
                      disabled={isSending}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Retake
                    </Button>
                    <Button
                      type="button"
                      className="rounded-full"
                      onClick={() => void handleSend()}
                      disabled={isSending}
                    >
                      {isSending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Send
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center text-white">
                <div
                  className={cn(
                    'flex h-18 w-18 items-center justify-center rounded-full',
                    error ? 'bg-amber-500/12 text-amber-300' : 'bg-white/8 text-white/80',
                  )}
                >
                  {error ? <AlertCircle className="h-8 w-8" /> : <Video className="h-8 w-8" />}
                </div>
                <div className="max-w-md">
                  <div className="text-lg font-medium">
                    {error ? 'Recorder unavailable' : 'Ready to capture'}
                  </div>
                  <div className="mt-2 text-sm text-white/60">
                    {error
                      ? error
                      : 'Use the Android recorder for a front-camera video message with native review, retake, and send controls.'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={closeModal}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Close
                  </Button>
                  <Button type="button" className="rounded-full" onClick={() => void launchRecorder()}>
                    <Camera className="mr-2 h-4 w-4" />
                    Retry
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
