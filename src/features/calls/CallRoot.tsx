import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import {
  Check,
  FlipHorizontal2,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  RotateCcw,
  Settings2,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';
import { toast } from 'sonner';
import { callsApi } from '@/api/endpoints';
import type {
  CallActionPayload,
  CallAnswerPayload,
  CallDoc,
  CallIceCandidatePayload,
  CallOfferPayload,
  CallPeerUserSummary,
  CallSession,
  CallTerminalPayload,
} from '@/api/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/Dialog';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { EVENTS } from '@/socket/events';
import { useSocketStore } from '@/socket/socket';
import {
  acceptIncomingCall,
  attemptCallRecovery,
  endCurrentCall,
  expandCallView,
  handleAcceptedSession,
  handleAnswerSignal,
  handleConnectedSignal,
  handleIceCandidateSignal,
  handleIncomingSession,
  handleOfferSignal,
  handleRecoveryExpired,
  handleReconnectingCall,
  handleResumedSession,
  handleSocketDisconnected,
  handleTerminalCall,
  hydrateRecoverableCall,
  minimizeCallView,
  refreshCallDevices,
  registerCallRemoteAudioElement,
  rejectIncomingCall,
  resetCallController,
  setMinimizedCallPosition,
  setBrowserAudioOutput,
  switchCamera,
  switchMicrophone,
  toggleCamera,
  toggleMicrophone,
  useCallStore,
  type RecoverySource,
} from './callController';

function getPeerLabel(peerUser: CallPeerUserSummary | null) {
  return peerUser?.display_name || peerUser?.username || peerUser?.id || 'Unknown user';
}

function getAvatarUrl(peerUser: CallPeerUserSummary | null) {
  if (!peerUser?.avatar || typeof peerUser.avatar !== 'object') {
    return undefined;
  }

  const url = peerUser.avatar.url;
  return typeof url === 'string' ? url : undefined;
}

function formatCountdown(milliseconds: number | null) {
  if (milliseconds === null) {
    return null;
  }

  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function useIsMobileViewport() {
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 767px)');
    const updateMatch = () => setIsMobileViewport(mediaQuery.matches);

    updateMatch();
    mediaQuery.addEventListener?.('change', updateMatch);
    window.addEventListener('resize', updateMatch);

    return () => {
      mediaQuery.removeEventListener?.('change', updateMatch);
      window.removeEventListener('resize', updateMatch);
    };
  }, []);

  return isMobileViewport;
}

function CallStreamVideo({
  stream,
  className,
  muted = false,
  mirrored = false,
}: {
  stream: MediaStream | null;
  className?: string;
  muted?: boolean;
  mirrored?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) {
      return;
    }

    node.srcObject = stream;
    void node.play().catch(() => {});
    return () => {
      node.pause();
      node.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={cn('h-full w-full object-cover', mirrored && 'scale-x-[-1]', className)}
    />
  );
}

function CallRemoteAudio({ stream }: { stream: MediaStream | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    registerCallRemoteAudioElement(audioRef.current);

    return () => {
      registerCallRemoteAudioElement(null);
    };
  }, []);

  useEffect(() => {
    const node = audioRef.current;
    if (!node) {
      return;
    }

    node.srcObject = stream;
    void node.play().catch(() => {});
    return () => {
      node.pause();
      node.srcObject = null;
    };
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
}

function RingingOverlay() {
  const phase = useCallStore((state) => state.phase);
  const call = useCallStore((state) => state.call);
  const peerUser = useCallStore((state) => state.peerUser);
  const isAccepting = useCallStore((state) => state.isAccepting);
  const isStarting = useCallStore((state) => state.isStarting);
  const isEnding = useCallStore((state) => state.isEnding);

  const peerLabel = getPeerLabel(peerUser);
  const avatarUrl = getAvatarUrl(peerUser);
  const isIncoming = phase === 'incoming-ringing';
  const isVideoCall = call?.type === 'video';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
      <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/95 text-white shadow-2xl">
        <div className="relative overflow-hidden px-8 pb-8 pt-10">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.28),_transparent_62%)]" />

          <div className="relative flex flex-col items-center text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-white/70">
              {isIncoming ? <PhoneIncoming className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
              {isVideoCall ? 'Video call' : 'Audio call'}
            </div>

            <Avatar className="h-24 w-24 border-2 border-white/15 shadow-lg">
              {avatarUrl ? <AvatarImage src={avatarUrl} className="object-cover" /> : null}
              <AvatarFallback className="bg-white/10 text-3xl text-white">
                {peerLabel[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>

            <div className="mt-6 text-2xl font-semibold tracking-tight">{peerLabel}</div>
            <div className="mt-2 text-sm text-white/70">
              {isIncoming ? 'Incoming call' : isStarting ? 'Starting call…' : 'Calling…'}
            </div>

            <div className="mt-8 flex items-center justify-center gap-3">
              {isIncoming ? (
                <Button
                  type="button"
                  size="lg"
                  className="min-w-32 bg-emerald-500 text-white hover:bg-emerald-600"
                  onClick={() => void acceptIncomingCall()}
                  disabled={isAccepting || isEnding}
                >
                  {isAccepting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Phone className="mr-2 h-4 w-4" />}
                  Accept
                </Button>
              ) : null}

              <Button
                type="button"
                size="lg"
                variant="destructive"
                className="min-w-32"
                onClick={() => void (isIncoming ? rejectIncomingCall() : endCurrentCall())}
                disabled={isAccepting || isEnding}
              >
                {isEnding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : isIncoming ? (
                  <PhoneMissed className="mr-2 h-4 w-4" />
                ) : (
                  <PhoneOff className="mr-2 h-4 w-4" />
                )}
                {isIncoming ? 'Decline' : 'Cancel'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReconnectingOverlay({
  remainingMs,
  onRetry,
}: {
  remainingMs: number | null;
  onRetry: () => void;
}) {
  const currentUserId = useAuthStore((state) => state.userId);
  const isSocketConnected = useSocketStore((state) => state.isConnected);
  const call = useCallStore((state) => state.call);
  const peerUser = useCallStore((state) => state.peerUser);
  const isResuming = useCallStore((state) => state.isResuming);
  const error = useCallStore((state) => state.error);
  const isEnding = useCallStore((state) => state.isEnding);

  const peerLabel = getPeerLabel(peerUser);
  const avatarUrl = getAvatarUrl(peerUser);
  const peerUserId = call && currentUserId
    ? call.caller_user_id === currentUserId
      ? call.callee_user_id
      : call.caller_user_id
    : null;
  const peerDisconnected = !!peerUserId && !!call?.disconnected_user_ids.includes(peerUserId);
  const selfDisconnected = !!currentUserId && !!call?.disconnected_user_ids.includes(currentUserId);
  const disconnectedLabels = [
    selfDisconnected ? 'You' : null,
    peerDisconnected ? peerLabel : null,
  ].filter(Boolean);
  const countdownLabel = formatCountdown(remainingMs);

  const statusLabel = !isSocketConnected
    ? 'Reconnecting to the server…'
    : isResuming
      ? 'Restoring the call…'
      : peerDisconnected
        ? `Waiting for ${peerLabel} to reconnect…`
        : selfDisconnected
          ? 'Rejoining the call…'
          : 'Recovering the call…';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-lg overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/95 text-white shadow-2xl">
        <div className="relative overflow-hidden px-8 pb-8 pt-10">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.28),_transparent_64%)]" />

          <div className="relative flex flex-col items-center text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-white/70">
              <RotateCcw className="h-3.5 w-3.5" />
              Recovering call
            </div>

            <Avatar className="h-24 w-24 border-2 border-white/15 shadow-lg">
              {avatarUrl ? <AvatarImage src={avatarUrl} className="object-cover" /> : null}
              <AvatarFallback className="bg-white/10 text-3xl text-white">
                {peerLabel[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>

            <div className="mt-6 text-2xl font-semibold tracking-tight">{peerLabel}</div>
            <div className="mt-2 text-sm text-white/70">{statusLabel}</div>

            {countdownLabel ? (
              <div className="mt-3 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
                Grace window: {countdownLabel} remaining
              </div>
            ) : null}

            {disconnectedLabels.length ? (
              <div className="mt-3 text-xs text-white/60">
                Disconnected: {disconnectedLabels.join(', ')}
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 w-full rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="min-w-32 bg-white/10 text-white hover:bg-white/15"
                onClick={onRetry}
                disabled={!isSocketConnected || isResuming || isEnding}
              >
                {isResuming ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                Retry
              </Button>

              <Button
                type="button"
                size="lg"
                variant="destructive"
                className="min-w-32"
                onClick={() => void endCurrentCall()}
                disabled={isEnding}
              >
                {isEnding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PhoneOff className="mr-2 h-4 w-4" />}
                End call
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CallDeviceOption({
  label,
  selected,
  disabled = false,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors',
        selected
          ? 'border-sky-400/40 bg-sky-500/10 text-white'
          : 'border-white/10 bg-white/5 text-white/85 hover:bg-white/10',
        disabled && 'cursor-wait opacity-70'
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="pr-4 text-sm font-medium">{label}</span>
      {selected ? <Check className="h-4 w-4 text-sky-300" /> : null}
    </button>
  );
}

function ActiveCallDeviceSheet({
  open,
  onOpenChange,
  isVideoCall,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isVideoCall: boolean;
}) {
  const availableMicrophones = useCallStore((state) => state.availableMicrophones);
  const availableCameras = useCallStore((state) => state.availableCameras);
  const availableAudioRoutes = useCallStore((state) => state.availableAudioRoutes);
  const selectedMicrophoneId = useCallStore((state) => state.selectedMicrophoneId);
  const selectedCameraId = useCallStore((state) => state.selectedCameraId);
  const selectedAudioRouteId = useCallStore((state) => state.selectedAudioRouteId);
  const [pendingSection, setPendingSection] = useState<'microphone' | 'camera' | 'audio' | null>(null);

  const showMicrophoneSection = availableMicrophones.length > 1;
  const showCameraSection = isVideoCall && availableCameras.length > 1;
  const showAudioSection = availableAudioRoutes.length > 1;

  const selectMicrophone = async (deviceId: string) => {
    setPendingSection('microphone');
    try {
      await switchMicrophone(deviceId);
    } catch (error) {
      console.error('Failed to switch microphone:', error);
      toast.error('Unable to switch the microphone.');
    } finally {
      setPendingSection(null);
    }
  };

  const selectCamera = async (deviceId: string) => {
    setPendingSection('camera');
    try {
      await switchCamera(deviceId);
    } catch (error) {
      console.error('Failed to switch camera:', error);
      toast.error('Unable to switch the camera.');
    } finally {
      setPendingSection(null);
    }
  };

  const selectAudioOutput = async (routeId: string) => {
    setPendingSection('audio');
    try {
      await setBrowserAudioOutput(routeId);
    } catch (error) {
      console.error('Failed to switch audio output:', error);
    } finally {
      setPendingSection(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[119] bg-black/85 backdrop-blur-md"
        className="z-[120] max-w-xl border-white/10 bg-slate-950/95 p-0 text-white shadow-2xl sm:rounded-[28px]"
      >
        <div className="border-b border-white/10 px-6 py-5">
          <DialogTitle className="text-base font-semibold text-white">Audio and camera</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-white/60">
            Switch devices without leaving the current call.
          </DialogDescription>
        </div>

        <div className="space-y-6 px-6 py-6">
          {showAudioSection ? (
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                Speaker
              </div>
              <div className="space-y-2">
                {availableAudioRoutes.map((route) => (
                  <CallDeviceOption
                    key={route.id}
                    label={route.label}
                    selected={selectedAudioRouteId === route.id}
                    disabled={pendingSection === 'audio'}
                    onClick={() => void selectAudioOutput(route.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {showMicrophoneSection ? (
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                Microphone
              </div>
              <div className="space-y-2">
                {availableMicrophones.map((device) => (
                  <CallDeviceOption
                    key={device.id}
                    label={device.label}
                    selected={selectedMicrophoneId === device.id}
                    disabled={pendingSection === 'microphone'}
                    onClick={() => void selectMicrophone(device.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {showCameraSection ? (
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
                Camera
              </div>
              <div className="space-y-2">
                {availableCameras.map((device) => (
                  <CallDeviceOption
                    key={device.id}
                    label={device.label}
                    selected={selectedCameraId === device.id}
                    disabled={pendingSection === 'camera'}
                    onClick={() => void selectCamera(device.id)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CallControlButton({
  label,
  active = false,
  destructive = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant={destructive ? 'destructive' : 'secondary'}
        className={cn(
          'h-14 w-14 rounded-[20px] border border-white/10 shadow-lg backdrop-blur-md',
          destructive
            ? 'border-red-400/25 bg-red-500 text-white hover:bg-red-600'
            : active
              ? 'bg-sky-500 text-white hover:bg-sky-600'
              : 'bg-white/10 text-white hover:bg-white/15'
        )}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </Button>
      <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">{label}</span>
    </div>
  );
}

function getNextOptionId<T extends { id: string }>(
  items: T[],
  currentId: string | null
) {
  if (items.length < 2) {
    return null;
  }

  const currentIndex = items.findIndex((item) => item.id === currentId);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % items.length : 0;
  return items[nextIndex]?.id || null;
}

const MINIMIZED_CALL_MARGIN = 16;

function clampMinimizedCallPosition(
  position: { x: number; y: number },
  size: { width: number; height: number }
) {
  if (typeof window === 'undefined') {
    return position;
  }

  const maxX = Math.max(
    MINIMIZED_CALL_MARGIN,
    window.innerWidth - size.width - MINIMIZED_CALL_MARGIN
  );
  const maxY = Math.max(
    MINIMIZED_CALL_MARGIN,
    window.innerHeight - size.height - MINIMIZED_CALL_MARGIN
  );

  return {
    x: Math.min(Math.max(MINIMIZED_CALL_MARGIN, position.x), maxX),
    y: Math.min(Math.max(MINIMIZED_CALL_MARGIN, position.y), maxY),
  };
}

function ActiveCallOverlay({ isVideoCall }: { isVideoCall: boolean }) {
  const phase = useCallStore((state) => state.phase);
  const call = useCallStore((state) => state.call);
  const peerUser = useCallStore((state) => state.peerUser);
  const localStream = useCallStore((state) => state.localStream);
  const remoteStream = useCallStore((state) => state.remoteStream);
  const isMicMuted = useCallStore((state) => state.isMicMuted);
  const isCameraEnabled = useCallStore((state) => state.isCameraEnabled);
  const isEnding = useCallStore((state) => state.isEnding);
  const availableMicrophones = useCallStore((state) => state.availableMicrophones);
  const availableCameras = useCallStore((state) => state.availableCameras);
  const availableAudioRoutes = useCallStore((state) => state.availableAudioRoutes);
  const browserAudioOutputSupported = useCallStore((state) => state.browserAudioOutputSupported);
  const selectedCameraId = useCallStore((state) => state.selectedCameraId);
  const selectedAudioRouteId = useCallStore((state) => state.selectedAudioRouteId);
  const [isDeviceSheetOpen, setIsDeviceSheetOpen] = useState(false);
  const [isCyclingSpeaker, setIsCyclingSpeaker] = useState(false);
  const [isCyclingCamera, setIsCyclingCamera] = useState(false);
  const isMobileViewport = useIsMobileViewport();

  const peerLabel = getPeerLabel(peerUser);
  const avatarUrl = getAvatarUrl(peerUser);
  const statusLabel =
    phase === 'active' ? 'Live now' : phase === 'ending' ? 'Ending call…' : 'Connecting…';
  const hasRemoteVideo = isVideoCall && !!remoteStream?.getVideoTracks().length;
  const hasMicChoices = availableMicrophones.length > 1;
  const hasCameraChoices = isVideoCall && availableCameras.length > 1;
  const hasAudioRouteChoices = availableAudioRoutes.length > 1;
  const hasDeviceSheet = hasMicChoices || hasCameraChoices || hasAudioRouteChoices;
  const canMinimize = phase === 'connecting' || phase === 'active';
  const canQuickSwitchSpeaker = isMobileViewport && hasAudioRouteChoices;
  const canQuickSwitchCamera = isMobileViewport && hasCameraChoices;

  const openSettingsSheet = () => {
    if (!hasDeviceSheet) {
      toast.info('No extra microphone, camera, or speaker options are available right now.');
      return;
    }

    setIsDeviceSheetOpen(true);
  };

  const openSpeakerSheet = () => {
    if (hasAudioRouteChoices) {
      setIsDeviceSheetOpen(true);
      return;
    }

    if (!browserAudioOutputSupported) {
      toast.info('This browser does not let websites choose speakers.');
      return;
    }

    toast.info('No alternate speaker outputs are available right now.');
  };

  const cycleSpeakerOutput = async () => {
    const nextRouteId = getNextOptionId(availableAudioRoutes, selectedAudioRouteId);
    if (!nextRouteId) {
      openSpeakerSheet();
      return;
    }

    setIsCyclingSpeaker(true);
    try {
      await setBrowserAudioOutput(nextRouteId);
    } catch (error) {
      console.error('Failed to cycle speaker output:', error);
    } finally {
      setIsCyclingSpeaker(false);
    }
  };

  const cycleCamera = async () => {
    const nextCameraId = getNextOptionId(availableCameras, selectedCameraId);
    if (!nextCameraId) {
      openSettingsSheet();
      return;
    }

    setIsCyclingCamera(true);
    try {
      await switchCamera(nextCameraId);
    } catch (error) {
      console.error('Failed to cycle camera:', error);
      toast.error('Unable to switch the camera.');
    } finally {
      setIsCyclingCamera(false);
    }
  };

  const shellClasses = isVideoCall
    ? 'fixed inset-0 z-[80] overflow-hidden bg-black text-white'
    : 'fixed inset-0 z-[80] overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_rgba(2,6,23,0.98)_74%)] text-white';

  return (
    <div className={shellClasses}>
      {isVideoCall ? (
        <>
          {hasRemoteVideo ? (
            <CallStreamVideo stream={remoteStream} muted className="absolute inset-0" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.28),_transparent_42%),linear-gradient(180deg,_rgba(15,23,42,0.84),_rgba(2,6,23,0.98))]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(2,6,23,0.18),_rgba(2,6,23,0.88))]" />
        </>
      ) : (
        <>
          <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.28),_transparent_62%)]" />
          <div className="absolute bottom-[-8rem] right-[-4rem] h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
          <div className="absolute left-[-6rem] top-1/3 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        </>
      )}

      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-6">
        <div className="rounded-[24px] border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-md">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
            {call?.type === 'video' ? 'Video call' : 'Audio call'}
          </div>
          <div className="mt-1 text-base font-semibold">{peerLabel}</div>
          <div className="mt-0.5 text-sm text-white/65">{statusLabel}</div>
        </div>

        <div className="flex items-center gap-2">
          {hasDeviceSheet ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-12 w-12 rounded-2xl border border-white/10 bg-black/35 text-white hover:bg-black/45"
              onClick={openSettingsSheet}
            >
              <Settings2 className="h-5 w-5" />
            </Button>
          ) : null}

          {canMinimize ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-12 w-12 rounded-2xl border border-white/10 bg-black/35 text-white hover:bg-black/45"
              onClick={minimizeCallView}
            >
              <Minimize2 className="h-5 w-5" />
            </Button>
          ) : null}
        </div>
      </div>

      {isVideoCall ? (
        <>
          {!hasRemoteVideo ? (
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-28 w-28 border-2 border-white/15 shadow-2xl">
                  {avatarUrl ? <AvatarImage src={avatarUrl} className="object-cover" /> : null}
                  <AvatarFallback className="bg-white/10 text-4xl text-white">
                    {peerLabel[0]?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="mt-6 text-3xl font-semibold tracking-tight">{peerLabel}</div>
                <div className="mt-2 text-sm text-white/65">{statusLabel}</div>
              </div>
            </div>
          ) : null}

          <div className="absolute bottom-32 right-4 h-44 w-32 overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/90 shadow-2xl sm:right-6 sm:h-56 sm:w-40">
            {localStream && isCameraEnabled ? (
              <CallStreamVideo stream={localStream} muted mirrored />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-slate-900 text-white/70">
                <VideoOff className="h-6 w-6" />
              </div>
            )}

            {canQuickSwitchCamera ? (
              <button
                type="button"
                className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white backdrop-blur-md transition-colors hover:bg-black/70 disabled:opacity-60"
                onClick={() => void cycleCamera()}
                disabled={isCyclingCamera}
                aria-label="Switch camera"
                title="Switch camera"
              >
                {isCyclingCamera ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlipHorizontal2 className="h-4 w-4" />}
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <div className="relative flex h-full items-center justify-center px-6 pb-28 pt-24">
          <div className="w-full max-w-xl rounded-[40px] border border-white/10 bg-white/5 px-8 py-10 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-32 w-32 border-2 border-white/15 shadow-xl">
                {avatarUrl ? <AvatarImage src={avatarUrl} className="object-cover" /> : null}
                <AvatarFallback className="bg-white/10 text-5xl text-white">
                  {peerLabel[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>

              <div className="mt-7 text-3xl font-semibold tracking-tight">{peerLabel}</div>
              <div className="mt-2 text-sm text-white/70">{statusLabel}</div>

              {hasDeviceSheet ? (
                <button
                  type="button"
                  className="mt-6 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white/55 transition-colors hover:bg-white/10"
                  onClick={openSettingsSheet}
                >
                  Open device controls
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex justify-center px-4 pb-6 sm:px-6">
        <div className="flex items-end gap-4 rounded-[32px] border border-white/10 bg-black/45 px-5 py-4 shadow-2xl backdrop-blur-md">
          <CallControlButton label={isMicMuted ? 'Muted' : 'Mic'} active={!isMicMuted} onClick={toggleMicrophone}>
            {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </CallControlButton>

          {isVideoCall ? (
            <CallControlButton label={isCameraEnabled ? 'Camera' : 'Camera off'} active={isCameraEnabled} onClick={toggleCamera}>
              {isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </CallControlButton>
          ) : null}

          <CallControlButton
            label="Speaker"
            active={hasAudioRouteChoices}
            disabled={isCyclingSpeaker}
            onClick={() => void (canQuickSwitchSpeaker ? cycleSpeakerOutput() : openSpeakerSheet())}
          >
            {isCyclingSpeaker ? <Loader2 className="h-5 w-5 animate-spin" /> : <Volume2 className="h-5 w-5" />}
          </CallControlButton>

          <CallControlButton
            label={isEnding ? 'Ending' : 'Hang up'}
            destructive
            disabled={isEnding}
            onClick={() => void endCurrentCall()}
          >
            {isEnding ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneOff className="h-5 w-5" />}
          </CallControlButton>
        </div>
      </div>

      <ActiveCallDeviceSheet
        open={isDeviceSheetOpen}
        onOpenChange={setIsDeviceSheetOpen}
        isVideoCall={isVideoCall}
      />
    </div>
  );
}

function MinimizedCallPip() {
  const phase = useCallStore((state) => state.phase);
  const call = useCallStore((state) => state.call);
  const peerUser = useCallStore((state) => state.peerUser);
  const localStream = useCallStore((state) => state.localStream);
  const remoteStream = useCallStore((state) => state.remoteStream);
  const isMicMuted = useCallStore((state) => state.isMicMuted);
  const isCameraEnabled = useCallStore((state) => state.isCameraEnabled);
  const isEnding = useCallStore((state) => state.isEnding);
  const minimizedCallPosition = useCallStore((state) => state.minimizedCallPosition);
  const isVideoCall = call?.type === 'video';
  const hasRemoteVideo = isVideoCall && !!remoteStream?.getVideoTracks().length;
  const peerLabel = getPeerLabel(peerUser);
  const avatarUrl = getAvatarUrl(peerUser);
  const statusLabel = phase === 'active' ? 'Live now' : 'Connecting…';
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    width: number;
    height: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    if (!minimizedCallPosition || typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      setMinimizedCallPosition(
        clampMinimizedCallPosition(minimizedCallPosition, {
          width: rect.width,
          height: rect.height,
        })
      );
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [minimizedCallPosition]);

  const finishDragging = (
    event: ReactPointerEvent<HTMLDivElement>,
    shouldExpand: boolean
  ) => {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }

    dragStateRef.current = null;
    setIsDragging(false);

    if (shouldExpand) {
      expandCallView();
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-call-pip-action="true"]')) {
      return;
    }

    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) {
      expandCallView();
      return;
    }

    const origin = minimizedCallPosition
      ? clampMinimizedCallPosition(
          minimizedCallPosition,
          { width: rect.width, height: rect.height }
        )
      : clampMinimizedCallPosition(
          { x: rect.left, y: rect.top },
          { width: rect.width, height: rect.height }
        );

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      width: rect.width,
      height: rect.height,
      moved: false,
    };

    if (!minimizedCallPosition) {
      setMinimizedCallPosition(origin);
    }

    setIsDragging(false);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    const moved = Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4;
    if (moved && !dragState.moved) {
      dragState.moved = true;
      setIsDragging(true);
    }

    const nextPosition = clampMinimizedCallPosition(
      {
        x: dragState.originX + deltaX,
        y: dragState.originY + deltaY,
      },
      {
        width: dragState.width,
        height: dragState.height,
      }
    );

    setMinimizedCallPosition(nextPosition);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    finishDragging(event, !dragState.moved);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    finishDragging(event, false);
  };

  if (!call) {
    return null;
  }

  const positionStyle = minimizedCallPosition
    ? {
        left: minimizedCallPosition.x,
        top: minimizedCallPosition.y,
      }
    : undefined;

  const positionClassName = minimizedCallPosition
    ? ''
    : 'bottom-5 right-4 sm:bottom-6 sm:right-6';

  const actionProps = {
    'data-call-pip-action': 'true',
    onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.stopPropagation();
    },
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
    },
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        'fixed z-[95] select-none touch-none overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/92 text-white shadow-2xl backdrop-blur-xl',
        'w-[11.5rem] max-w-[calc(100vw-2rem)] sm:w-52',
        isVideoCall ? 'h-[15.5rem] sm:h-72' : 'min-h-[11rem]',
        positionClassName,
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      )}
      style={positionStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      role="button"
      tabIndex={0}
      aria-label={`Return to ${peerLabel}'s call`}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          expandCallView();
        }
      }}
    >
      {isVideoCall ? (
        <div className="relative h-full w-full">
          {hasRemoteVideo ? (
            <CallStreamVideo stream={remoteStream} muted className="absolute inset-0" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.32),_transparent_42%),linear-gradient(180deg,_rgba(15,23,42,0.9),_rgba(2,6,23,0.98))]" />
          )}

          <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(2,6,23,0.18),_rgba(2,6,23,0.9))]" />

          {!hasRemoteVideo ? (
            <div className="absolute inset-x-0 top-6 flex flex-col items-center px-4 text-center">
              <Avatar className="h-16 w-16 border border-white/15 shadow-lg">
                {avatarUrl ? <AvatarImage src={avatarUrl} className="object-cover" /> : null}
                <AvatarFallback className="bg-white/10 text-xl text-white">
                  {peerLabel[0]?.toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
            </div>
          ) : null}

          {localStream && isCameraEnabled ? (
            <div className="absolute right-3 top-3 h-14 w-10 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 shadow-lg">
              <CallStreamVideo stream={localStream} muted mirrored />
            </div>
          ) : null}

          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="rounded-[24px] border border-white/10 bg-black/45 p-3 backdrop-blur-md">
              <div className="text-sm font-semibold">{peerLabel}</div>
              <div className="mt-1 text-xs text-white/65">{statusLabel}</div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <Button
                  {...actionProps}
                  type="button"
                  size="icon"
                  variant="secondary"
                  className={cn(
                    'h-10 w-10 rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15',
                    !isMicMuted && 'bg-sky-500 text-white hover:bg-sky-600'
                  )}
                  onClick={(event) => {
                    actionProps.onClick(event);
                    toggleMicrophone();
                  }}
                >
                  {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>

                <Button
                  {...actionProps}
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-10 w-10 rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15"
                  onClick={(event) => {
                    actionProps.onClick(event);
                    expandCallView();
                  }}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>

                <Button
                  {...actionProps}
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="h-10 w-10 rounded-2xl"
                  onClick={(event) => {
                    actionProps.onClick(event);
                    void endCurrentCall();
                  }}
                  disabled={isEnding}
                >
                  {isEnding ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_58%),linear-gradient(180deg,_rgba(15,23,42,0.96),_rgba(2,6,23,0.98))] p-4">
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Avatar className="h-16 w-16 border border-white/15 shadow-lg">
              {avatarUrl ? <AvatarImage src={avatarUrl} className="object-cover" /> : null}
              <AvatarFallback className="bg-white/10 text-xl text-white">
                {peerLabel[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="mt-4 text-sm font-semibold">{peerLabel}</div>
            <div className="mt-1 text-xs text-white/65">{statusLabel}</div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <Button
              {...actionProps}
              type="button"
              size="icon"
              variant="secondary"
              className={cn(
                'h-10 w-10 rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15',
                !isMicMuted && 'bg-sky-500 text-white hover:bg-sky-600'
              )}
              onClick={(event) => {
                actionProps.onClick(event);
                toggleMicrophone();
              }}
            >
              {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>

            <Button
              {...actionProps}
              type="button"
              size="icon"
              variant="secondary"
              className="h-10 w-10 rounded-2xl border border-white/10 bg-white/10 text-white hover:bg-white/15"
              onClick={(event) => {
                actionProps.onClick(event);
                expandCallView();
              }}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>

            <Button
              {...actionProps}
              type="button"
              size="icon"
              variant="destructive"
              className="h-10 w-10 rounded-2xl"
              onClick={(event) => {
                actionProps.onClick(event);
                void endCurrentCall();
              }}
              disabled={isEnding}
            >
              {isEnding ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EndedOverlay() {
  const call = useCallStore((state) => state.call);
  const peerUser = useCallStore((state) => state.peerUser);
  const endScreenMessage = useCallStore((state) => state.endScreenMessage);

  const peerLabel = getPeerLabel(peerUser);
  const avatarUrl = getAvatarUrl(peerUser);
  const statusLabel =
    call?.status === 'rejected'
      ? 'Call declined'
      : call?.status === 'expired'
        ? 'Missed call'
        : call?.status === 'cancelled'
          ? 'Call cancelled'
          : call?.type === 'video'
            ? 'Video call ended'
            : 'Audio call ended';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-md overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/95 text-white shadow-2xl">
        <div className="relative overflow-hidden px-8 pb-8 pt-10">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,_rgba(248,113,113,0.22),_transparent_62%)]" />

          <div className="relative flex flex-col items-center text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-white/70">
              <PhoneOff className="h-3.5 w-3.5" />
              {statusLabel}
            </div>

            <Avatar className="h-24 w-24 border-2 border-white/15 shadow-lg">
              {avatarUrl ? <AvatarImage src={avatarUrl} className="object-cover" /> : null}
              <AvatarFallback className="bg-white/10 text-3xl text-white">
                {peerLabel[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>

            <div className="mt-6 text-2xl font-semibold tracking-tight">{peerLabel}</div>
            <div className="mt-2 text-sm text-white/70">{endScreenMessage || 'The call ended.'}</div>
            <div className="mt-4 text-xs uppercase tracking-[0.2em] text-white/45">Closing…</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AudioCallOverlay() {
  return <ActiveCallOverlay isVideoCall={false} />;
}

function VideoCallOverlay() {
  return <ActiveCallOverlay isVideoCall />;
}

export function CallRoot() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const socket = useSocketStore((state) => state.socket);
  const isSocketConnected = useSocketStore((state) => state.isConnected);
  const phase = useCallStore((state) => state.phase);
  const callPresentationMode = useCallStore((state) => state.callPresentationMode);
  const call = useCallStore((state) => state.call);
  const localStream = useCallStore((state) => state.localStream);
  const remoteStream = useCallStore((state) => state.remoteStream);
  const [now, setNow] = useState(() => Date.now());
  const lastRecoveryCheckSocketIdRef = useRef<string | null>(null);
  const expiredCallIdRef = useRef<string | null>(null);

  const refreshRecoverableCall = async (source: RecoverySource) => {
    try {
      const session = await callsApi.getActive();

      if (!session) {
        if (useCallStore.getState().phase === 'reconnecting') {
          handleRecoveryExpired(
            source === 'manual'
              ? 'No recoverable call was found.'
              : 'The call could not be recovered.'
          );
        }
        return;
      }

      hydrateRecoverableCall(session);
      await attemptCallRecovery(source);
    } catch (error) {
      console.error('Failed to fetch active call:', error);
      if (source === 'manual') {
        toast.error('Unable to check for a recoverable call right now.');
      }
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      lastRecoveryCheckSocketIdRef.current = null;
      expiredCallIdRef.current = null;
      resetCallController();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isSocketConnected) {
      lastRecoveryCheckSocketIdRef.current = null;
    }
  }, [isSocketConnected]);

  useEffect(() => {
    if (!isAuthenticated || !isSocketConnected || !socket?.id) {
      return;
    }

    const state = useCallStore.getState();
    if (state.phase !== 'idle' && state.phase !== 'reconnecting') {
      return;
    }

    if (lastRecoveryCheckSocketIdRef.current === socket.id) {
      return;
    }

    lastRecoveryCheckSocketIdRef.current = socket.id;
    void refreshRecoverableCall(state.phase === 'idle' ? 'page-load' : 'socket-connect');
  }, [isAuthenticated, isSocketConnected, socket?.id]);

  useEffect(() => {
    if (phase !== 'reconnecting') {
      expiredCallIdRef.current = null;
      return;
    }

    if (!call?.reconnect_deadline_at) {
      return;
    }

    setNow(Date.now());
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [phase, call?.reconnect_deadline_at]);

  const reconnectRemainingMs = useMemo(() => {
    if (!call?.reconnect_deadline_at) {
      return null;
    }

    return Math.max(0, new Date(call.reconnect_deadline_at).getTime() - now);
  }, [call?.reconnect_deadline_at, now]);

  useEffect(() => {
    if (phase !== 'reconnecting' || !call?.id || reconnectRemainingMs === null || reconnectRemainingMs > 0) {
      return;
    }

    if (expiredCallIdRef.current === call.id) {
      return;
    }

    expiredCallIdRef.current = call.id;
    handleRecoveryExpired();
  }, [phase, call?.id, reconnectRemainingMs]);

  useEffect(() => {
    if (phase === 'reconnecting' && callPresentationMode === 'minimized') {
      expandCallView();
    }
  }, [callPresentationMode, phase]);

  useEffect(() => {
    if (!call?.id || !localStream || typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    void refreshCallDevices();

    if (!navigator.mediaDevices.addEventListener) {
      return;
    }

    const handleDeviceChange = () => {
      void refreshCallDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener?.('devicechange', handleDeviceChange);
    };
  }, [call?.id, localStream]);

  useEffect(() => {
    if (!isAuthenticated || !socket) {
      return;
    }

    const wrapAsync = <T,>(handler: (payload: T) => Promise<void> | void, label: string) => {
      return (payload: T) => {
        Promise.resolve()
          .then(() => handler(payload))
          .catch((error) => {
            console.error(`Call handler failed for ${label}:`, error);
            toast.error('A call signaling error occurred.');
            if (useCallStore.getState().phase !== 'reconnecting') {
              resetCallController();
            }
          });
      };
    };

    const handleIncoming = wrapAsync<CallSession>(handleIncomingSession, EVENTS.CALL_INCOMING);
    const handleAccepted = wrapAsync<CallSession>(handleAcceptedSession, EVENTS.CALL_ACCEPTED);
    const handleRejected = wrapAsync<CallTerminalPayload>(handleTerminalCall, EVENTS.CALL_REJECTED);
    const handleRecoveryAvailable = wrapAsync<CallSession>(async (payload) => {
      hydrateRecoverableCall(payload);
      await attemptCallRecovery('recovery-available');
    }, EVENTS.CALL_RECOVERY_AVAILABLE);
    const handleOffer = wrapAsync<CallOfferPayload>(handleOfferSignal, EVENTS.CALL_OFFER);
    const handleAnswer = wrapAsync<CallAnswerPayload>(handleAnswerSignal, EVENTS.CALL_ANSWER);
    const handleIce = wrapAsync<CallIceCandidatePayload>(handleIceCandidateSignal, EVENTS.CALL_ICE_CANDIDATE);
    const handleConnected = wrapAsync<CallActionPayload>(handleConnectedSignal, EVENTS.CALL_CONNECTED);
    const handleReconnecting = wrapAsync<CallDoc>(handleReconnectingCall, EVENTS.CALL_RECONNECTING);
    const handleResumed = wrapAsync<CallSession>(handleResumedSession, EVENTS.CALL_RESUMED);
    const handleEnded = wrapAsync<CallTerminalPayload>(handleTerminalCall, EVENTS.CALL_ENDED);
    const handleDisconnect = () => {
      handleSocketDisconnected();
    };

    socket.on(EVENTS.CALL_INCOMING, handleIncoming);
    socket.on(EVENTS.CALL_ACCEPTED, handleAccepted);
    socket.on(EVENTS.CALL_REJECTED, handleRejected);
    socket.on(EVENTS.CALL_RECOVERY_AVAILABLE, handleRecoveryAvailable);
    socket.on(EVENTS.CALL_OFFER, handleOffer);
    socket.on(EVENTS.CALL_ANSWER, handleAnswer);
    socket.on(EVENTS.CALL_ICE_CANDIDATE, handleIce);
    socket.on(EVENTS.CALL_CONNECTED, handleConnected);
    socket.on(EVENTS.CALL_RECONNECTING, handleReconnecting);
    socket.on(EVENTS.CALL_RESUMED, handleResumed);
    socket.on(EVENTS.CALL_ENDED, handleEnded);
    socket.on(EVENTS.DISCONNECT, handleDisconnect);

    return () => {
      socket.off(EVENTS.CALL_INCOMING, handleIncoming);
      socket.off(EVENTS.CALL_ACCEPTED, handleAccepted);
      socket.off(EVENTS.CALL_REJECTED, handleRejected);
      socket.off(EVENTS.CALL_RECOVERY_AVAILABLE, handleRecoveryAvailable);
      socket.off(EVENTS.CALL_OFFER, handleOffer);
      socket.off(EVENTS.CALL_ANSWER, handleAnswer);
      socket.off(EVENTS.CALL_ICE_CANDIDATE, handleIce);
      socket.off(EVENTS.CALL_CONNECTED, handleConnected);
      socket.off(EVENTS.CALL_RECONNECTING, handleReconnecting);
      socket.off(EVENTS.CALL_RESUMED, handleResumed);
      socket.off(EVENTS.CALL_ENDED, handleEnded);
      socket.off(EVENTS.DISCONNECT, handleDisconnect);
    };
  }, [isAuthenticated, socket]);

  const isRinging = useMemo(
    () => phase === 'incoming-ringing' || phase === 'outgoing-ringing',
    [phase]
  );
  const isMinimized =
    callPresentationMode === 'minimized' &&
    (phase === 'connecting' || phase === 'active');
  const remoteAudio = !isRinging && phase !== 'ended' ? <CallRemoteAudio stream={remoteStream} /> : null;

  if (!isAuthenticated || phase === 'idle' || !call) {
    return null;
  }

  if (phase === 'reconnecting') {
    return (
      <>
        {remoteAudio}
        <ReconnectingOverlay
          remainingMs={reconnectRemainingMs}
          onRetry={() => void refreshRecoverableCall('manual')}
        />
      </>
    );
  }

  if (phase === 'ended') {
    return <EndedOverlay />;
  }

  if (isRinging) {
    return <RingingOverlay />;
  }

  if (isMinimized) {
    return (
      <>
        {remoteAudio}
        <MinimizedCallPip />
      </>
    );
  }

  if (call.type === 'video') {
    return (
      <>
        {remoteAudio}
        <VideoCallOverlay />
      </>
    );
  }

  return (
    <>
      {remoteAudio}
      <AudioCallOverlay />
    </>
  );
}

export default CallRoot;
