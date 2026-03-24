import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Camera, CameraOff, FlipHorizontal2, Loader2, Pause, Play, RotateCcw, Send, Square, Video, X } from 'lucide-react';
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
import { ComposerReplyTarget } from '../../types/message';

const HARD_MAX_VIDEO_SIZE_BYTES = 10 * 1024 * 1024;
const SAFE_MAX_VIDEO_SIZE_BYTES = Math.floor(HARD_MAX_VIDEO_SIZE_BYTES * 0.9);
const FALLBACK_MAX_VIDEO_DURATION_MS = 10_000;
const MAX_ESTIMATED_VIDEO_DURATION_MS = 90_000;
const DEFAULT_AUDIO_BITRATE = 64_000;

type CapturePhase = 'live' | 'recording' | 'recorded';
type StopReason = 'manual' | 'time_limit' | 'size_limit' | 'dismissed' | null;

interface RecordingProfile {
  mimeType: string;
  width: number;
  height: number;
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
  totalBitsPerSecond: number;
  safeMaxBytes: number;
  safeMaxDurationMs: number;
}

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

const getPreferredRecorderMimeType = () => {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  const candidates = [
    'video/webm',
    'video/webm;codecs=vp8,opus',
    'video/mp4',
    'video/quicktime',
    'video/webm;codecs=h264,opus',
    'video/webm;codecs=vp9,opus',
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
};

const normalizeRecordedVideoMimeType = (mimeType: string) => getSupportedVideoMime(mimeType) || 'video/webm';

const getFileExtension = (mimeType: string) => {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('quicktime')) return 'mov';
  return 'webm';
};

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatFileSize = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const scoreCameraLabel = (label: string) => {
  const normalized = label.toLowerCase();
  if (/(front|user|selfie|face|facetime)/.test(normalized)) return 0;
  if (/(rear|back|environment|world|tele|ultra|wide)/.test(normalized)) return 1;
  return 2;
};

const sortVideoDevices = (devices: MediaDeviceInfo[]) =>
  [...devices].sort((left, right) => {
    const scoreDifference = scoreCameraLabel(left.label) - scoreCameraLabel(right.label);
    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return left.label.localeCompare(right.label);
  });

const isFrontFacingCamera = (label?: string | null) => (label ? scoreCameraLabel(label) === 0 : true);

const estimateVideoBitsPerSecond = ({
  width,
  height,
  mimeType,
  isFrontCamera,
  isMobile,
}: {
  width: number;
  height: number;
  mimeType: string;
  isFrontCamera: boolean;
  isMobile: boolean;
}) => {
  const pixelCount = Math.max(1, width * height);

  let videoBitsPerSecond: number;
  if (pixelCount <= 640 * 480) {
    videoBitsPerSecond = 900_000;
  } else if (pixelCount <= 960 * 540) {
    videoBitsPerSecond = 1_250_000;
  } else if (pixelCount <= 1280 * 720) {
    videoBitsPerSecond = 2_100_000;
  } else if (pixelCount <= 1920 * 1080) {
    videoBitsPerSecond = 3_400_000;
  } else {
    videoBitsPerSecond = 4_500_000;
  }

  if (isFrontCamera) {
    videoBitsPerSecond *= 0.86;
  }

  if (isMobile) {
    videoBitsPerSecond *= 0.88;
  }

  if (mimeType.includes('vp9')) {
    videoBitsPerSecond *= 0.82;
  } else if (mimeType.includes('mp4') || mimeType.includes('quicktime') || mimeType.includes('h264')) {
    videoBitsPerSecond *= 1.08;
  }

  return Math.round(videoBitsPerSecond);
};

const buildRecordingProfile = ({
  mimeType,
  width,
  height,
  isFrontCamera,
  isMobile,
  videoBitsPerSecond,
  audioBitsPerSecond = DEFAULT_AUDIO_BITRATE,
}: {
  mimeType: string;
  width: number;
  height: number;
  isFrontCamera: boolean;
  isMobile: boolean;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
}): RecordingProfile => {
  const resolvedVideoBitsPerSecond =
    videoBitsPerSecond || estimateVideoBitsPerSecond({ width, height, mimeType, isFrontCamera, isMobile });
  const resolvedAudioBitsPerSecond = Math.max(32_000, Math.round(audioBitsPerSecond));
  const totalBitsPerSecond = resolvedVideoBitsPerSecond + resolvedAudioBitsPerSecond;
  const safeMaxDurationMs = Math.max(
    FALLBACK_MAX_VIDEO_DURATION_MS,
    Math.min(
      MAX_ESTIMATED_VIDEO_DURATION_MS,
      Math.floor((SAFE_MAX_VIDEO_SIZE_BYTES * 8 * 1000) / totalBitsPerSecond)
    )
  );

  return {
    mimeType,
    width,
    height,
    videoBitsPerSecond: resolvedVideoBitsPerSecond,
    audioBitsPerSecond: resolvedAudioBitsPerSecond,
    totalBitsPerSecond,
    safeMaxBytes: SAFE_MAX_VIDEO_SIZE_BYTES,
    safeMaxDurationMs,
  };
};

export default function VideoRecorderModal({
  open,
  onOpenChange,
  receiverId,
  onSendVideo,
  replyTarget,
  onClearReplyTarget,
}: VideoRecorderModalProps) {
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bytesRef = useRef(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordStartedAtRef = useRef<number | null>(null);
  const recordedDurationMsRef = useRef(0);
  const stopReasonRef = useRef<StopReason>(null);
  const discardOnStopRef = useRef(false);

  const [capturePhase, setCapturePhase] = useState<CapturePhase>('live');
  const [isPreparingCamera, setIsPreparingCamera] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [recordingDurationSec, setRecordingDurationSec] = useState(0);
  const [recordedSizeBytes, setRecordedSizeBytes] = useState(0);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recordedMimeType, setRecordedMimeType] = useState('video/webm');
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [recordingProfile, setRecordingProfile] = useState<RecordingProfile | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);

  const activeCameraLabel = useMemo(() => {
    const matchedCamera = availableCameras.find((device) => device.deviceId === selectedCameraId);
    if (matchedCamera?.label) {
      return matchedCamera.label;
    }

    return availableCameras.length > 1 ? `Camera ${availableCameras.findIndex((device) => device.deviceId === selectedCameraId) + 1}` : 'Camera preview';
  }, [availableCameras, selectedCameraId]);

  const hasRecordedVideo = !!recordedBlob && !!recordedUrl;
  const canSwitchCamera = !isPreparingCamera && capturePhase !== 'recording' && availableCameras.length > 1;
  const safeMaxBytes = recordingProfile?.safeMaxBytes ?? SAFE_MAX_VIDEO_SIZE_BYTES;
  const safeMaxDurationMs = recordingProfile?.safeMaxDurationMs ?? FALLBACK_MAX_VIDEO_DURATION_MS;
  const estimatedProfileBytesPerMs =
    ((recordingProfile?.totalBitsPerSecond ?? ((safeMaxBytes * 8 * 1000) / safeMaxDurationMs)) / 8) / 1000;
  const observedBytesPerMs =
    recordingElapsedMs > 1000 ? (recordedSizeBytes / Math.max(1, recordingElapsedMs)) * 1.08 : 0;
  const effectiveBytesPerMs = Math.max(estimatedProfileBytesPerMs, observedBytesPerMs);
  const estimatedRecordingSizeBytes = hasRecordedVideo
    ? recordedSizeBytes
    : isPreparingCamera
      ? 0
      : Math.max(recordedSizeBytes, Math.ceil(recordingElapsedMs * effectiveBytesPerMs));
  const recordingRemainingMs =
    effectiveBytesPerMs > 0
      ? Math.max(0, Math.floor((safeMaxBytes - estimatedRecordingSizeBytes) / effectiveBytesPerMs))
      : Math.max(0, safeMaxDurationMs - recordingElapsedMs);
  const recordingProgressPercent = Math.min(100, (estimatedRecordingSizeBytes / safeMaxBytes) * 100);

  const clearTimers = () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }

    recordStartedAtRef.current = null;
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
  };

  const resetRecordedPreview = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }

    if (previewVideoRef.current) {
      previewVideoRef.current.pause();
      previewVideoRef.current.currentTime = 0;
    }

    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordedSizeBytes(0);
    setRecordedMimeType('video/webm');
    setIsPreviewPlaying(false);
    setPreviewProgress(0);
  };

  const resetCaptureState = () => {
    clearTimers();
    stopReasonRef.current = null;
    discardOnStopRef.current = false;
    recorderRef.current = null;
    recordedDurationMsRef.current = 0;
    setCapturePhase('live');
    setRecordingElapsedMs(0);
    setRecordingDurationSec(0);
    setCaptureError(null);
    resetRecordedPreview();
  };

  const teardownModalState = () => {
    discardOnStopRef.current = true;

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }

    clearTimers();
    stopStream();
    recorderRef.current = null;
    chunksRef.current = [];
    bytesRef.current = 0;
    setIsPreparingCamera(false);
    setIsSending(false);
    setAvailableCameras([]);
    setSelectedCameraId(null);
    setRecordingProfile(null);
    resetCaptureState();
  };

  const attachLivePreview = async (stream: MediaStream, target: HTMLVideoElement | null = liveVideoRef.current) => {
    if (!target) {
      return;
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack || videoTrack.readyState !== 'live') {
      return;
    }

    if (target.srcObject !== stream) {
      target.srcObject = stream;
    }

    if (target.readyState < HTMLMediaElement.HAVE_METADATA) {
      await new Promise<void>((resolve) => {
        const handleLoadedMetadata = () => resolve();
        target.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
      });
    }

    if (target.paused) {
      void target.play().catch((error) => {
        console.error('Error starting live camera preview:', error);
      });
    }
  };

  const setLiveVideoElement = (node: HTMLVideoElement | null) => {
    liveVideoRef.current = node;

    if (node && streamRef.current) {
      void attachLivePreview(streamRef.current, node);
    }
  };

  const prepareCamera = async (cameraId?: string | null) => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCaptureError('Camera recording is not available in this browser.');
      return;
    }

    setIsPreparingCamera(true);
    setCaptureError(null);
    stopStream();

    try {
      const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 768;
      const selectedCamera = cameraId
        ? availableCameras.find((device) => device.deviceId === cameraId) || null
        : null;
      const prefersFrontCamera = isFrontFacingCamera(selectedCamera?.label);
      const preferredMimeType = getPreferredRecorderMimeType() || 'video/webm';
      const idealWidth = isMobileViewport ? (prefersFrontCamera ? 960 : 1280) : 1280;
      const idealHeight = isMobileViewport ? (prefersFrontCamera ? 540 : 720) : 720;
      const initialStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: cameraId
          ? {
              deviceId: { exact: cameraId },
              width: { ideal: idealWidth },
              height: { ideal: idealHeight },
            }
          : {
              facingMode: 'user',
              width: { ideal: idealWidth },
              height: { ideal: idealHeight },
            },
      });

      streamRef.current = initialStream;
      void attachLivePreview(initialStream);

      const devices = sortVideoDevices(
        (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'videoinput')
      );

      setAvailableCameras(devices);

      const activeTrack = initialStream.getVideoTracks()[0];
      const activeSettings = activeTrack?.getSettings();
      const activeDeviceId = activeTrack?.getSettings().deviceId || cameraId || devices[0]?.deviceId || null;
      const activeCameraLabel =
        devices.find((device) => device.deviceId === activeDeviceId)?.label || activeTrack?.label || selectedCamera?.label || null;
      const resolvedWidth = Math.max(640, Math.round(activeSettings?.width || idealWidth));
      const resolvedHeight = Math.max(360, Math.round(activeSettings?.height || idealHeight));

      setRecordingProfile(
        buildRecordingProfile({
          mimeType: preferredMimeType,
          width: resolvedWidth,
          height: resolvedHeight,
          isFrontCamera: isFrontFacingCamera(activeCameraLabel),
          isMobile: isMobileViewport,
        })
      );
      setSelectedCameraId(activeDeviceId);
      setCapturePhase('live');
    } catch (error) {
      console.error('Error preparing video recording:', error);
      stopStream();
      setCaptureError('Could not access the camera and microphone. Allow permissions and try again.');
    } finally {
      setIsPreparingCamera(false);
    }
  };

  const closeModal = () => {
    if (isSending) {
      return;
    }

    teardownModalState();
    onOpenChange(false);
  };

  const stopRecordingInternal = (reason: StopReason = 'manual') => {
    if (!recorderRef.current || recorderRef.current.state === 'inactive') {
      return;
    }

    stopReasonRef.current = reason;
    recorderRef.current.stop();
    clearTimers();
    setCapturePhase('live');
  };

  const startRecording = async () => {
    if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
      setCaptureError('Video recording is not supported in this browser.');
      return;
    }

    if (!streamRef.current) {
      await prepareCamera(selectedCameraId);
    }

    if (!streamRef.current) {
      return;
    }

    resetRecordedPreview();
    setCaptureError(null);
    setRecordingElapsedMs(0);
    setRecordedSizeBytes(0);
    recordedDurationMsRef.current = 0;
    chunksRef.current = [];
    bytesRef.current = 0;
    discardOnStopRef.current = false;

    try {
      const streamTrackSettings = streamRef.current.getVideoTracks()[0]?.getSettings();
      const fallbackMimeType = getPreferredRecorderMimeType() || 'video/webm';
      const baseProfile =
        recordingProfile ||
        buildRecordingProfile({
          mimeType: fallbackMimeType,
          width: Math.max(640, Math.round(streamTrackSettings?.width || 960)),
          height: Math.max(360, Math.round(streamTrackSettings?.height || 540)),
          isFrontCamera: isFrontFacingCamera(activeCameraLabel),
          isMobile: typeof window !== 'undefined' && window.innerWidth < 768,
        });
      const preferredMimeType = baseProfile.mimeType;
      const recorderOptions: MediaRecorderOptions = preferredMimeType
        ? {
            mimeType: preferredMimeType,
            audioBitsPerSecond: baseProfile.audioBitsPerSecond,
            videoBitsPerSecond: baseProfile.videoBitsPerSecond,
          }
        : {
            audioBitsPerSecond: baseProfile.audioBitsPerSecond,
            videoBitsPerSecond: baseProfile.videoBitsPerSecond,
          };
      const recorder = new MediaRecorder(streamRef.current, recorderOptions);

      recorderRef.current = recorder;
      const activeProfile = buildRecordingProfile({
        mimeType: preferredMimeType,
        width: baseProfile.width,
        height: baseProfile.height,
        isFrontCamera: isFrontFacingCamera(activeCameraLabel),
        isMobile: typeof window !== 'undefined' && window.innerWidth < 768,
        videoBitsPerSecond: recorder.videoBitsPerSecond || baseProfile.videoBitsPerSecond,
        audioBitsPerSecond: recorder.audioBitsPerSecond || baseProfile.audioBitsPerSecond,
      });
      setRecordingProfile(activeProfile);

      recorder.ondataavailable = (event) => {
        if (!event.data || event.data.size === 0) {
          return;
        }

        chunksRef.current.push(event.data);
        bytesRef.current += event.data.size;
        setRecordedSizeBytes(bytesRef.current);

        if (bytesRef.current >= activeProfile.safeMaxBytes && recorder.state !== 'inactive') {
          stopReasonRef.current = 'size_limit';
          recorder.stop();
        }
      };

      recorder.onstop = () => {
        clearTimers();

        const shouldDiscard = discardOnStopRef.current;
        const finalDurationMs = Math.max(
          recordedDurationMsRef.current,
          chunksRef.current.length ? recordingDurationSec * 1000 : 0
        );
        const finalMimeType = normalizeRecordedVideoMimeType(
          recorder.mimeType || preferredMimeType || 'video/webm'
        );
        const finalBlob = new Blob(chunksRef.current, { type: finalMimeType });

        recorderRef.current = null;
        stopStream();

        if (shouldDiscard) {
          chunksRef.current = [];
          bytesRef.current = 0;
          setCapturePhase('live');
          setRecordingElapsedMs(0);
          setRecordingDurationSec(0);
          return;
        }

        if (finalBlob.size > HARD_MAX_VIDEO_SIZE_BYTES) {
          chunksRef.current = [];
          bytesRef.current = 0;
          setCaptureError('Recording exceeded the 10 MB limit and was discarded.');
          setRecordingElapsedMs(0);
          setRecordingDurationSec(0);
          void prepareCamera(selectedCameraId);
          return;
        }

        const nextUrl = URL.createObjectURL(finalBlob);
        setRecordedBlob(finalBlob);
        setRecordedUrl(nextUrl);
        setRecordedMimeType(finalMimeType);
        setRecordedSizeBytes(finalBlob.size);
        setRecordingElapsedMs(finalDurationMs);
        setRecordingDurationSec(Math.max(1, Math.round(finalDurationMs / 1000)));
        setCapturePhase('recorded');
        chunksRef.current = [];
        bytesRef.current = 0;
      };

      recorder.start(250);
      setCapturePhase('recording');
      setRecordingElapsedMs(0);
      setRecordingDurationSec(0);

      const startedAt = Date.now();
      recordStartedAtRef.current = startedAt;
      durationIntervalRef.current = setInterval(() => {
        const elapsedMs = Date.now() - startedAt;
        recordedDurationMsRef.current = elapsedMs;
        const boundedElapsedMs = Math.min(activeProfile.safeMaxDurationMs, elapsedMs);
        const estimatedBytes = Math.max(
          bytesRef.current,
          Math.ceil((activeProfile.totalBitsPerSecond / 8 / 1000) * boundedElapsedMs)
        );

        setRecordingElapsedMs(boundedElapsedMs);
        setRecordingDurationSec(Math.max(1, Math.ceil(boundedElapsedMs / 1000)));

        if (estimatedBytes >= activeProfile.safeMaxBytes && recorder.state !== 'inactive') {
          stopReasonRef.current = 'size_limit';
          recorder.stop();
        }
      }, 200);
      autoStopTimeoutRef.current = setTimeout(() => {
        stopRecordingInternal('time_limit');
      }, activeProfile.safeMaxDurationMs);
    } catch (error) {
      console.error('Error starting video recording:', error);
      setCaptureError('Could not start video recording on this device.');
    }
  };

  const retakeRecording = async () => {
    resetRecordedPreview();
    setCaptureError(null);
    setCapturePhase('live');
    setRecordingElapsedMs(0);
    setRecordingDurationSec(0);
    await prepareCamera(selectedCameraId);
  };

  const switchCamera = async () => {
    if (!canSwitchCamera) {
      return;
    }

    const currentIndex = availableCameras.findIndex((device) => device.deviceId === selectedCameraId);
    const nextCamera = availableCameras[(currentIndex + 1 + availableCameras.length) % availableCameras.length];

    if (!nextCamera) {
      return;
    }

    await prepareCamera(nextCamera.deviceId);
  };

  const handleSend = async () => {
    if (!recordedBlob) {
      return;
    }

    if (recordedBlob.size > HARD_MAX_VIDEO_SIZE_BYTES) {
      setCaptureError('Recording exceeded the 10 MB limit and cannot be sent.');
      return;
    }

    setIsSending(true);

    try {
      const file = new File([recordedBlob], `video-message.${getFileExtension(recordedMimeType)}`, {
        type: recordedMimeType,
      });

      await onSendVideo({
        type: 'media',
        media_kind: 'video',
        receiver_id: receiverId,
        file,
        duration_ms: recordingDurationSec * 1000,
        reply_mode: replyTarget?.mode,
        reply_to_message_id: replyTarget?.messageId,
      });

      onClearReplyTarget?.();
      closeModal();
    } catch (error) {
      console.error('Error sending recorded video:', error);
      setCaptureError('Failed to send recorded video.');
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    if (!open) {
      teardownModalState();
      return;
    }

    void prepareCamera(selectedCameraId);

    return () => {
      clearTimers();
      stopStream();
    };
  }, [open]);

  useEffect(() => {
    if (!open || isPreparingCamera || hasRecordedVideo) {
      return;
    }

    const stream = streamRef.current;
    if (!stream || !liveVideoRef.current) {
      return;
    }

    void attachLivePreview(stream, liveVideoRef.current);
  }, [open, isPreparingCamera, hasRecordedVideo, capturePhase, selectedCameraId]);

  useEffect(() => {
    return () => {
      teardownModalState();
    };
  }, []);

  useEffect(() => {
    if (!isReviewMode || !previewVideoRef.current) {
      return;
    }

    previewVideoRef.current.pause();
    previewVideoRef.current.currentTime = 0;
    setIsPreviewPlaying(false);
    setPreviewProgress(0);
  }, [recordedUrl]);

  const isRecordingActive = capturePhase === 'recording';
  const isReviewMode = hasRecordedVideo;
  const statusLabel = isRecordingActive ? 'Recording' : isReviewMode ? 'Review' : 'Camera';
  const timerLabel = formatDuration(recordingDurationSec);
  const remainingLabel = formatDuration(Math.ceil(recordingRemainingMs / 1000));
  const maxDurationLabel = formatDuration(Math.ceil(safeMaxDurationMs / 1000));
  const estimatedSizeLabel = formatFileSize(estimatedRecordingSizeBytes);
  const safeSizeLabel = formatFileSize(safeMaxBytes);
  const footerHint = isReviewMode
    ? 'Review this clip, then send it or retake it.'
    : isRecordingActive
      ? 'Recording stops automatically before the safe upload size is reached.'
      : streamRef.current
        ? 'Tap record to capture a video sized to stay under the upload limit.'
        : 'Allow camera access to start recording.';

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
          onPointerDownOutside={(event) => {
            if (capturePhase === 'recording' || isSending) {
              event.preventDefault();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (capturePhase === 'recording' || isSending) {
              event.preventDefault();
            }
          }}
        >
          <DialogTitle className="sr-only">Record video</DialogTitle>
          <DialogDescription className="sr-only">
            Full-screen camera mode for recording and reviewing a size-aware video message.
          </DialogDescription>

          <div className="relative h-full w-full overflow-hidden bg-black text-white">
            <div className="absolute inset-0">
              {isPreparingCamera ? (
                <div className="flex h-full items-center justify-center">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 backdrop-blur">
                      <Loader2 className="h-7 w-7 animate-spin" />
                    </div>
                    <div>
                      <div className="text-base font-semibold sm:text-lg">Preparing camera</div>
                      <div className="mt-1 text-sm text-white/70">Checking camera and microphone access…</div>
                    </div>
                  </div>
                </div>
              ) : isReviewMode ? (
                <div className="relative h-full w-full">
                  <video
                    ref={previewVideoRef}
                    src={recordedUrl || ''}
                    className="h-full w-full object-contain bg-black"
                    playsInline
                    preload="metadata"
                    onClick={() => {
                      if (!previewVideoRef.current) return;
                      if (previewVideoRef.current.paused || previewVideoRef.current.ended) {
                        void previewVideoRef.current.play();
                      } else {
                        previewVideoRef.current.pause();
                      }
                    }}
                    onPlaying={() => setIsPreviewPlaying(true)}
                    onPause={() => setIsPreviewPlaying(false)}
                    onTimeUpdate={(event) => {
                      const duration = event.currentTarget.duration || 0;
                      if (!duration) {
                        setPreviewProgress(0);
                        return;
                      }
                      setPreviewProgress((event.currentTarget.currentTime / duration) * 100);
                    }}
                    onEnded={() => {
                      setIsPreviewPlaying(false);
                      setPreviewProgress(100);
                    }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/12 via-transparent to-black/22" />
                  {!isPreviewPlaying ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-white/20 bg-black/45 text-white shadow-xl backdrop-blur-md">
                        <Play className="ml-1 h-8 w-8 fill-current" />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : streamRef.current ? (
                <video
                  ref={setLiveVideoElement}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  playsInline
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center">
                  <div className="flex max-w-sm flex-col items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 backdrop-blur">
                      {captureError ? <CameraOff className="h-9 w-9 text-white/80" /> : <Camera className="h-9 w-9 text-white/80" />}
                    </div>
                    <div>
                      <div className="text-lg font-semibold">Camera preview unavailable</div>
                      <div className="mt-2 text-sm text-white/70">
                        {captureError || 'Allow camera and microphone access to record a video message.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/72 via-transparent via-40% to-black/85" />

            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:p-5 sm:pt-[calc(1.25rem+env(safe-area-inset-top))] md:p-6 md:pt-6">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/55 disabled:opacity-50"
                  onClick={closeModal}
                  disabled={isSending}
                  aria-label="Close video recorder"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="flex items-center gap-2">
                  <div className="rounded-full border border-white/12 bg-black/35 px-3 py-2 text-[11px] font-medium text-white/90 backdrop-blur-md sm:text-xs">
                    {statusLabel}
                  </div>
                  <button
                    type="button"
                    className="pointer-events-auto flex h-11 items-center justify-center rounded-full border border-white/15 bg-black/35 px-3 text-sm text-white backdrop-blur-md transition-colors hover:bg-black/55 disabled:opacity-50"
                    onClick={() => void switchCamera()}
                    disabled={!canSwitchCamera}
                    aria-label="Switch camera"
                    title="Switch camera"
                  >
                    <FlipHorizontal2 className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Switch</span>
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-4">
                <div
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-md',
                    isRecordingActive
                      ? 'border-red-400/35 bg-red-500/85 text-white'
                      : 'border-white/12 bg-black/35 text-white/90'
                  )}
                >
                  {isRecordingActive ? `REC ${timerLabel}` : isReviewMode ? 'Preview ready' : 'Ready to record'}
                </div>
                <div className="rounded-full border border-white/12 bg-black/35 px-3 py-1.5 text-xs text-white/85 backdrop-blur-md">
                  {isRecordingActive ? `${remainingLabel} left` : activeCameraLabel}
                </div>
                <div className="rounded-full border border-white/12 bg-black/35 px-3 py-1.5 text-xs text-white/85 backdrop-blur-md">
                  {isReviewMode ? recordedMimeType : `${maxDurationLabel} max`}
                </div>
                <div className="rounded-full border border-white/12 bg-black/35 px-3 py-1.5 text-xs text-white/85 backdrop-blur-md">
                  {isReviewMode ? formatFileSize(recordedSizeBytes) : `${estimatedSizeLabel} / ${safeSizeLabel}`}
                </div>
              </div>

              {captureError ? (
                <div
                  className={cn(
                    'mt-3 flex max-w-xl items-start gap-2 rounded-2xl border px-3 py-2.5 text-sm backdrop-blur-md',
                    streamRef.current || isReviewMode
                      ? 'border-amber-300/35 bg-amber-500/18 text-amber-50'
                      : 'border-red-400/35 bg-red-500/18 text-red-50'
                  )}
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{captureError}</span>
                </div>
              ) : null}
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-5 sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:p-6 md:pb-6">
              <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
                {replyTarget ? (
                  <div className="max-w-md rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-white backdrop-blur-md">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-primary-foreground/90">
                      {replyTarget.mode === 'thread' ? 'Thread Reply' : 'Reply'}
                    </div>
                    <div className="mt-1 text-xs text-white/65">{replyTarget.senderLabel}</div>
                    <div className="truncate text-sm text-white">{replyTarget.previewText}</div>
                  </div>
                ) : null}

                {isRecordingActive ? (
                  <div className="overflow-hidden rounded-full bg-white/15 backdrop-blur-sm">
                    <div
                      className="h-1.5 rounded-full bg-red-500 transition-[width] duration-150"
                      style={{ width: `${recordingProgressPercent}%` }}
                    />
                  </div>
                ) : isReviewMode ? (
                  <div className="overflow-hidden rounded-full bg-white/15 backdrop-blur-sm">
                    <div
                      className="h-1.5 rounded-full bg-primary transition-[width] duration-150"
                      style={{ width: `${previewProgress}%` }}
                    />
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 rounded-[28px] border border-white/10 bg-black/38 px-4 py-4 backdrop-blur-md sm:px-5 sm:py-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white sm:text-base">
                        {isReviewMode ? 'Review video' : isRecordingActive ? 'Recording now' : 'Camera mode'}
                      </div>
                      <div className="text-xs text-white/65 sm:text-sm">{footerHint}</div>
                    </div>
                    <div className="rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs text-white/80">
                      {isReviewMode ? formatFileSize(recordedSizeBytes) : `${estimatedSizeLabel} / ${safeSizeLabel}`}
                    </div>
                  </div>

                  <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3">
                    {isReviewMode ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 rounded-full border-white/20 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white"
                          onClick={() => {
                            const previewVideo = previewVideoRef.current;
                            if (!previewVideo) return;

                            if (previewVideo.paused || previewVideo.ended) {
                              if (previewVideo.ended) {
                                previewVideo.currentTime = 0;
                                setPreviewProgress(0);
                              }
                              void previewVideo.play();
                            } else {
                              previewVideo.pause();
                            }
                          }}
                          disabled={isSending}
                        >
                          {isPreviewPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4 fill-current" />}
                          {isPreviewPlaying ? 'Pause' : 'Play'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 rounded-full border-white/20 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white"
                          onClick={() => void retakeRecording()}
                          disabled={isSending}
                        >
                          <RotateCcw className="mr-2 h-4 w-4" />
                          Retake
                        </Button>
                        <Button
                          type="button"
                          className="h-12 rounded-full bg-primary px-6 text-primary-foreground shadow-lg hover:bg-primary/90"
                          onClick={handleSend}
                          disabled={isSending}
                        >
                          {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                          Send video
                        </Button>
                      </>
                    ) : isRecordingActive ? (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 rounded-full border-white/20 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white"
                          onClick={closeModal}
                          disabled={isSending}
                        >
                          Cancel
                        </Button>
                        <button
                          type="button"
                          className="flex h-20 w-20 items-center justify-center rounded-full border-[10px] border-white/20 bg-red-500 text-white shadow-[0_0_0_10px_rgba(255,255,255,0.08)] transition-transform hover:scale-[1.02] active:scale-95"
                          onClick={() => stopRecordingInternal('manual')}
                          aria-label="Stop recording"
                        >
                          <Square className="h-7 w-7 fill-current" />
                        </button>
                        <div className="flex min-w-[5.5rem] justify-end text-sm font-medium text-white/80">
                          {remainingLabel} left
                        </div>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 rounded-full border-white/20 bg-white/5 px-5 text-white hover:bg-white/10 hover:text-white"
                          onClick={streamRef.current ? closeModal : () => void prepareCamera(selectedCameraId)}
                          disabled={isSending || isPreparingCamera}
                        >
                          {streamRef.current ? 'Cancel' : 'Retry'}
                        </Button>
                        <button
                          type="button"
                          className="flex h-20 w-20 items-center justify-center rounded-full border-[10px] border-white/20 bg-white text-red-500 shadow-[0_0_0_10px_rgba(255,255,255,0.08)] transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => void startRecording()}
                          disabled={isPreparingCamera || isSending || !streamRef.current}
                          aria-label="Start recording"
                        >
                          {isPreparingCamera ? <Loader2 className="h-7 w-7 animate-spin" /> : <div className="h-7 w-7 rounded-full bg-red-500" />}
                        </button>
                        <div className="flex min-w-[5.5rem] justify-end text-sm font-medium text-white/80">
                          {maxDurationLabel} max
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
