import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { SendMediaInput } from '@/hooks/useChat';
import type { ComposerReplyTarget } from '../../types/message';
import VideoRecorderModal from '../../media/recorders/VideoRecorderModal';
import { RecorderAudioPreview } from '../../media/recorders/RecorderAudioPreview';
import { RecorderRecordingState } from '../../media/recorders/RecorderRecordingState';
import { useAudioRecorderController } from '../../media/recorders/useAudioRecorderController';

export type ComposerRecorderMode = 'audio' | 'video';

export interface ComposerRecorderTriggerProps {
  mode: ComposerRecorderMode;
  currentLabel: string;
  currentIcon: ComposerRecorderMode;
  nextMode: ComposerRecorderMode | null;
  nextLabel: string | null;
  nextIcon: ComposerRecorderMode | null;
  canSwitchMode: boolean;
  disabled: boolean;
  onPressStart: () => void;
  onPressEnd: () => void;
  onClick: () => void;
  onToggleMode: () => void;
}

export interface ComposerRecorderProps {
  audio?: boolean;
  video?: boolean;
  defaultMode?: ComposerRecorderMode;
  receiverId: string;
  onSendMedia: (data: SendMediaInput) => Promise<unknown>;
  replyTarget?: ComposerReplyTarget | null;
  onClearReplyTarget?: () => void;
  disabled?: boolean;
  onEngage?: () => void;
  renderIdleRow: (trigger: ComposerRecorderTriggerProps) => ReactNode;
}

function getModeLabel(mode: ComposerRecorderMode) {
  return mode === 'audio' ? 'Audio' : 'Video';
}

function getNextMode(mode: ComposerRecorderMode): ComposerRecorderMode {
  return mode === 'audio' ? 'video' : 'audio';
}

function resolveRecorderMode(
  requestedMode: ComposerRecorderMode,
  audioEnabled: boolean,
  videoEnabled: boolean,
  fallbackMode: ComposerRecorderMode = 'audio'
): ComposerRecorderMode {
  if (!audioEnabled && !videoEnabled) {
    throw new Error('At least one recorder capability must be enabled.');
  }

  if (requestedMode === 'audio' && audioEnabled) {
    return 'audio';
  }

  if (requestedMode === 'video' && videoEnabled) {
    return 'video';
  }

  if (fallbackMode === 'audio' && audioEnabled) {
    return 'audio';
  }

  if (fallbackMode === 'video' && videoEnabled) {
    return 'video';
  }

  return audioEnabled ? 'audio' : 'video';
}

export function ComposerRecorder({
  audio = true,
  video = true,
  defaultMode = 'audio',
  receiverId,
  onSendMedia,
  replyTarget,
  onClearReplyTarget,
  disabled = false,
  onEngage,
  renderIdleRow,
}: ComposerRecorderProps) {
  if (!audio && !video) {
    throw new Error('ComposerRecorder requires at least one enabled capability.');
  }

  const [recorderModeState, setRecorderModeState] = useState<ComposerRecorderMode>(
    () => resolveRecorderMode(defaultMode, audio, video)
  );
  const [isVideoRecorderOpen, setIsVideoRecorderOpen] = useState(false);
  const recorderMode = resolveRecorderMode(
    recorderModeState,
    audio,
    video,
    defaultMode
  );
  const audioRecorder = useAudioRecorderController({
    receiverId,
    onSendMedia,
    replyTarget,
    onClearReplyTarget,
  });
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionTriggeredRef = useRef(false);

  const clearPressTimeout = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  useEffect(() => clearPressTimeout, []);

  useEffect(() => {
    setRecorderModeState((current) =>
      resolveRecorderMode(current, audio, video, defaultMode)
    );
  }, [audio, video, defaultMode]);

  const engage = () => {
    onEngage?.();
  };

  const handleRecorderAction = () => {
    engage();

    if (recorderMode === 'video') {
      if (video) {
        setIsVideoRecorderOpen(true);
        return;
      }

      if (audio) {
        void audioRecorder.startAudioRecording();
      }
      return;
    }

    if (audio) {
      void audioRecorder.startAudioRecording();
      return;
    }

    if (video) {
      setIsVideoRecorderOpen(true);
    }
  };

  const handlePressStart = () => {
    if (disabled) {
      return;
    }

    actionTriggeredRef.current = false;
    clearPressTimeout();
    longPressTimeoutRef.current = setTimeout(() => {
      actionTriggeredRef.current = true;
      handleRecorderAction();
    }, 280);
  };

  const handlePressEnd = () => {
    clearPressTimeout();
  };

  const handleClick = () => {
    if (disabled) {
      return;
    }

    if (actionTriggeredRef.current) {
      actionTriggeredRef.current = false;
      return;
    }

    handleRecorderAction();
  };

  const canSwitchMode =
    audio &&
    video &&
    !disabled &&
    !audioRecorder.isRecording &&
    !audioRecorder.audioUrl &&
    !isVideoRecorderOpen;

  const nextMode = canSwitchMode ? getNextMode(recorderMode) : null;

  const triggerProps: ComposerRecorderTriggerProps = {
    mode: recorderMode,
    currentLabel: getModeLabel(recorderMode),
    currentIcon: recorderMode,
    nextMode,
    nextLabel: nextMode ? getModeLabel(nextMode) : null,
    nextIcon: nextMode,
    canSwitchMode,
    disabled,
    onPressStart: handlePressStart,
    onPressEnd: handlePressEnd,
    onClick: handleClick,
    onToggleMode: () => {
      if (!canSwitchMode) return;
      setRecorderModeState((current) => getNextMode(current));
    },
  };

  return (
    <>
      <VideoRecorderModal
        open={isVideoRecorderOpen}
        onOpenChange={setIsVideoRecorderOpen}
        receiverId={receiverId}
        onSendVideo={onSendMedia}
        replyTarget={replyTarget}
        onClearReplyTarget={onClearReplyTarget}
      />

      {audioRecorder.isRecording ? (
        <RecorderRecordingState
          isRecordingPaused={audioRecorder.isRecordingPaused}
          durationSec={audioRecorder.durationSec}
          onPauseOrResume={
            audioRecorder.isRecordingPaused
              ? () => void audioRecorder.resumeAudioRecording()
              : () => void audioRecorder.pauseAudioRecording()
          }
          onStop={() => void audioRecorder.stopAudioRecording()}
        />
      ) : audioRecorder.audioUrl ? (
        <RecorderAudioPreview
          audioUrl={audioRecorder.audioUrl}
          audioRef={audioRecorder.audioRef}
          isPlayingPreview={audioRecorder.isPlayingPreview}
          previewProgress={audioRecorder.previewProgress}
          durationSec={audioRecorder.durationSec}
          isBusy={disabled || audioRecorder.isSendingAudio}
          isSendingAudio={audioRecorder.isSendingAudio}
          onCancel={() => void audioRecorder.cancelAudioRecording()}
          onTogglePlayback={audioRecorder.togglePreviewPlayback}
          onSend={() => void audioRecorder.sendRecordedAudio()}
          onSetProgress={audioRecorder.setPreviewProgress}
          onSetPlaying={audioRecorder.setIsPlayingPreview}
        />
      ) : (
        renderIdleRow(triggerProps)
      )}
    </>
  );
}
