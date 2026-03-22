import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { VoiceRecorder as CapacitorVoiceRecorder } from 'capacitor-voice-recorder';
import type { SendMediaInput } from '@/hooks/useChat';
import { getSocket } from '@/socket/socket';
import { EVENTS } from '@/socket/events';
import { ComposerReplyTarget } from '../types/message';

interface UseAudioRecorderControllerParams {
  receiverId: string;
  onSendMedia: (data: SendMediaInput) => Promise<unknown>;
  replyTarget?: ComposerReplyTarget | null;
  onClearReplyTarget?: () => void;
}

export function useAudioRecorderController({
  receiverId,
  onSendMedia,
  replyTarget,
  onClearReplyTarget,
}: UseAudioRecorderControllerParams) {
  const [recorderMode, setRecorderMode] = useState<'audio' | 'video'>('audio');
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [isSendingAudio, setIsSendingAudio] = useState(false);
  const [isVideoRecorderOpen, setIsVideoRecorderOpen] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState('audio/webm');
  const [audioFileName, setAudioFileName] = useState('voice.webm');
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingPausedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isNativeAndroid =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

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
      if (isNativeAndroid) {
        const permission =
          await CapacitorVoiceRecorder.requestAudioRecordingPermission();
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
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioMimeType('audio/webm');
        setAudioFileName('voice.webm');
        emitTypingStop();
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setIsRecordingPaused(false);
      isRecordingPausedRef.current = false;
      setDurationSec(0);
      setAudioBlob(null);
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
      if (isNativeAndroid) {
        await CapacitorVoiceRecorder.pauseRecording();
      } else if (mediaRecorderRef.current) {
        mediaRecorderRef.current.pause();
      } else {
        return;
      }

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
      if (isNativeAndroid) {
        await CapacitorVoiceRecorder.resumeRecording();
      } else if (mediaRecorderRef.current) {
        mediaRecorderRef.current.resume();
      } else {
        return;
      }

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
      if (isNativeAndroid) {
        const { value } = await CapacitorVoiceRecorder.stopRecording();
        if (value.recordDataBase64) {
          setAudioBlob(blobFromBase64(value.recordDataBase64, value.mimeType));
        }
        setAudioMimeType(value.mimeType);
        setAudioFileName(`voice.${getFileExtension(value.mimeType)}`);
        setDurationSec(Math.max(1, Math.round(value.msDuration / 1000)));
        emitTypingStop();
      } else if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
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
        type: 'voice',
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

  const handleRecorderAction = () => {
    if (recorderMode === 'video') {
      setIsVideoRecorderOpen(true);
      return;
    }

    void startAudioRecording();
  };

  return {
    recorderMode,
    isRecording,
    isRecordingPaused,
    isSendingAudio,
    isVideoRecorderOpen,
    durationSec,
    audioUrl,
    isPlayingPreview,
    previewProgress,
    audioRef,
    setRecorderMode,
    setIsVideoRecorderOpen,
    setPreviewProgress,
    setIsPlayingPreview,
    pauseAudioRecording,
    resumeAudioRecording,
    stopAudioRecording,
    cancelAudioRecording,
    togglePreviewPlayback,
    sendRecordedAudio,
    handleRecorderAction,
  };
}
