import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { VoiceRecorder as CapacitorVoiceRecorder } from 'capacitor-voice-recorder';
import { useAudioRecorderController as useBrowserAudioRecorderController } from '@/features/chat/media/recorders/useAudioRecorderController';
import type { SendMediaInput } from '@/hooks/useChat';
import { getSocket } from '@/socket/socket';
import { EVENTS } from '@/socket/events';
import type { ComposerReplyTarget } from '@/features/chat/types/message';

interface UseAudioRecorderControllerParams {
  receiverId: string;
  onSendMedia: (data: SendMediaInput) => Promise<unknown>;
  replyTarget?: ComposerReplyTarget | null;
  onClearReplyTarget?: () => void;
}

const isNativeAndroid =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export function useAudioRecorderController(params: UseAudioRecorderControllerParams) {
  const browserController = useBrowserAudioRecorderController(params);

  if (!isNativeAndroid) {
    return browserController;
  }

  const { receiverId, onSendMedia, replyTarget, onClearReplyTarget } = params;
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isSendingAudio, setIsSendingAudio] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState('audio/webm');
  const [audioFileName, setAudioFileName] = useState('voice.webm');
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingPausedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const emitTypingStart = () => {
    const socket = getSocket();
    socket?.emit(EVENTS.CLIENT_TYPING_START, { to: receiverId, receiver_id: receiverId });
  };

  const emitTypingStop = () => {
    const socket = getSocket();
    socket?.emit(EVENTS.CLIENT_TYPING_STOP, { to: receiverId, receiver_id: receiverId });
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!audioBlob) {
      setAudioUrl(null);
      setIsPlayingPreview(false);
      setPreviewProgress(0);
      return;
    }

    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  const getFileExtension = (mimeType: string) => {
    if (mimeType.includes('aac') || mimeType.includes('mp4')) return 'm4a';
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
    if (mimeType.includes('ogg')) return 'ogg';
    if (mimeType.includes('wav')) return 'wav';
    return 'webm';
  };

  const blobFromBase64 = (base64: string, mimeType: string) => {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new Blob([bytes], { type: mimeType });
  };

  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    timerRef.current = setInterval(() => {
      setDurationSec((current) => current + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startAudioRecording = async () => {
    try {
      const permission = await CapacitorVoiceRecorder.requestAudioRecordingPermission();
      if (!permission.value) {
        alert('Microphone permission is required to record voice messages.');
        return;
      }

      const canRecord = await CapacitorVoiceRecorder.canDeviceVoiceRecord();
      if (!canRecord.value) {
        alert('This Android device cannot record audio.');
        return;
      }

      await CapacitorVoiceRecorder.startRecording();
      setAudioBlob(null);
      setAudioMimeType('audio/aac');
      setAudioFileName('voice.m4a');
      setIsRecording(true);
      setIsRecordingPaused(false);
      isRecordingPausedRef.current = false;
      setDurationSec(0);
      startTimer();
      emitTypingStart();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not start recording. Please allow microphone access and try again.');
    }
  };

  const pauseAudioRecording = async () => {
    if (!isRecording || isRecordingPaused) return;

    try {
      await CapacitorVoiceRecorder.pauseRecording();
      setIsRecordingPaused(true);
      isRecordingPausedRef.current = true;
      stopTimer();
    } catch (error) {
      console.error('Error pausing recording:', error);
    }
  };

  const resumeAudioRecording = async () => {
    if (!isRecording || !isRecordingPaused) return;

    try {
      await CapacitorVoiceRecorder.resumeRecording();
      setIsRecordingPaused(false);
      isRecordingPausedRef.current = false;
      startTimer();
    } catch (error) {
      console.error('Error resuming recording:', error);
    }
  };

  const stopAudioRecording = async () => {
    if (!isRecording) return;

    try {
      const { value } = await CapacitorVoiceRecorder.stopRecording();
      if (value.recordDataBase64) {
        setAudioBlob(blobFromBase64(value.recordDataBase64, value.mimeType));
      }
      setAudioMimeType(value.mimeType);
      setAudioFileName(`voice.${getFileExtension(value.mimeType)}`);
      setDurationSec(Math.max(1, Math.round(value.msDuration / 1000)));
      emitTypingStop();
    } catch (error) {
      console.error('Error stopping recording:', error);
      alert('Failed to finish recording.');
    } finally {
      setIsRecording(false);
      setIsRecordingPaused(false);
      isRecordingPausedRef.current = false;
      stopTimer();
    }
  };

  const cancelAudioRecording = async () => {
    await stopAudioRecording();
    setAudioBlob(null);
    setAudioMimeType('audio/webm');
    setAudioFileName('voice.webm');
    setDurationSec(0);
  };

  const togglePreviewPlayback = () => {
    if (!audioRef.current) return;

    if (isPlayingPreview) {
      audioRef.current.pause();
      setIsPlayingPreview(false);
      return;
    }

    void audioRef.current.play();
    setIsPlayingPreview(true);
  };

  const sendRecordedAudio = async () => {
    if (!audioBlob || isSendingAudio) return;

    setIsSendingAudio(true);
    try {
      const file = new File([audioBlob], audioFileName, { type: audioMimeType });
      await onSendMedia({
        type: 'media',
        media_kind: 'voice',
        receiver_id: receiverId,
        file,
        duration_ms: durationSec * 1000,
        reply_mode: replyTarget?.mode,
        reply_to_message_id: replyTarget?.messageId,
      });
      setAudioBlob(null);
      setDurationSec(0);
      onClearReplyTarget?.();
    } catch (error) {
      console.error('Error uploading voice:', error);
      alert('Failed to send voice message');
    } finally {
      setIsSendingAudio(false);
    }
  };

  return {
    isRecording,
    isRecordingPaused,
    isSendingAudio,
    durationSec,
    audioUrl,
    isPlayingPreview,
    previewProgress,
    audioRef,
    setPreviewProgress,
    setIsPlayingPreview,
    startAudioRecording,
    pauseAudioRecording,
    resumeAudioRecording,
    stopAudioRecording,
    cancelAudioRecording,
    togglePreviewPlayback,
    sendRecordedAudio,
  };
}
