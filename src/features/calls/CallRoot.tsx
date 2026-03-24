import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Loader2,
  Mic,
  MicOff,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  RotateCcw,
  Video,
  VideoOff,
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
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { EVENTS } from '@/socket/events';
import { useSocketStore } from '@/socket/socket';
import {
  acceptIncomingCall,
  attemptCallRecovery,
  endCurrentCall,
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
  rejectIncomingCall,
  resetCallController,
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

function CallStreamAudio({ stream }: { stream: MediaStream | null }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

function AudioCallOverlay() {
  const phase = useCallStore((state) => state.phase);
  const call = useCallStore((state) => state.call);
  const peerUser = useCallStore((state) => state.peerUser);
  const remoteStream = useCallStore((state) => state.remoteStream);
  const isMicMuted = useCallStore((state) => state.isMicMuted);
  const isEnding = useCallStore((state) => state.isEnding);

  const peerLabel = getPeerLabel(peerUser);
  const avatarUrl = getAvatarUrl(peerUser);
  const statusLabel =
    phase === 'active' ? 'Live now' : phase === 'ending' ? 'Ending call…' : 'Connecting…';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(30,41,59,0.95),_rgba(2,6,23,0.98)_72%)] p-4 text-white">
      <CallStreamAudio stream={remoteStream} />
      <div className="w-full max-w-lg rounded-[36px] border border-white/10 bg-white/5 px-8 py-10 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-white/70">
            {call?.type === 'video' ? 'Video call' : 'Audio call'}
          </div>

          <Avatar className="h-28 w-28 border-2 border-white/15 shadow-xl">
            {avatarUrl ? <AvatarImage src={avatarUrl} className="object-cover" /> : null}
            <AvatarFallback className="bg-white/10 text-4xl text-white">
              {peerLabel[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>

          <div className="mt-6 text-3xl font-semibold tracking-tight">{peerLabel}</div>
          <div className="mt-2 text-sm text-white/70">{statusLabel}</div>

          <div className="mt-10 flex items-center justify-center gap-3">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-14 w-14 rounded-full bg-white/10 text-white hover:bg-white/15"
              onClick={toggleMicrophone}
            >
              {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>

            <Button
              type="button"
              size="icon"
              variant="destructive"
              className="h-16 w-16 rounded-full"
              onClick={() => void endCurrentCall()}
              disabled={isEnding}
            >
              {isEnding ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneOff className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>
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

function VideoCallOverlay() {
  const phase = useCallStore((state) => state.phase);
  const peerUser = useCallStore((state) => state.peerUser);
  const localStream = useCallStore((state) => state.localStream);
  const remoteStream = useCallStore((state) => state.remoteStream);
  const isMicMuted = useCallStore((state) => state.isMicMuted);
  const isCameraEnabled = useCallStore((state) => state.isCameraEnabled);
  const isEnding = useCallStore((state) => state.isEnding);

  const peerLabel = getPeerLabel(peerUser);
  const statusLabel =
    phase === 'active' ? 'Live now' : phase === 'ending' ? 'Ending call…' : 'Connecting…';
  const hasRemoteVideo = !!remoteStream?.getVideoTracks().length;

  return (
    <div className="fixed inset-0 z-[80] overflow-hidden bg-black text-white">
      {!hasRemoteVideo ? <CallStreamAudio stream={remoteStream} /> : null}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.32),_transparent_48%),linear-gradient(180deg,_rgba(2,6,23,0.2),_rgba(2,6,23,0.88))]" />

      {hasRemoteVideo ? (
        <CallStreamVideo stream={remoteStream} className="absolute inset-0" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
          <div className="text-center">
            <div className="text-3xl font-semibold tracking-tight">{peerLabel}</div>
            <div className="mt-2 text-sm text-white/65">{statusLabel}</div>
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 sm:p-6">
        <div className="rounded-full border border-white/10 bg-black/35 px-4 py-2 backdrop-blur-md">
          <div className="text-sm font-semibold">{peerLabel}</div>
          <div className="text-xs text-white/70">{statusLabel}</div>
        </div>
      </div>

      <div className="absolute bottom-28 right-4 h-40 w-28 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 shadow-2xl sm:bottom-32 sm:right-6 sm:h-52 sm:w-36">
        {localStream && isCameraEnabled ? (
          <CallStreamVideo stream={localStream} muted mirrored />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-slate-900 text-white/70">
            <VideoOff className="h-6 w-6" />
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex justify-center p-6">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/45 px-4 py-3 shadow-2xl backdrop-blur-md">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/15"
            onClick={toggleMicrophone}
          >
            {isMicMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>

          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/15"
            onClick={toggleCamera}
          >
            {isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>

          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="h-14 w-14 rounded-full"
            onClick={() => void endCurrentCall()}
            disabled={isEnding}
          >
            {isEnding ? <Loader2 className="h-5 w-5 animate-spin" /> : <PhoneOff className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CallRoot() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const socket = useSocketStore((state) => state.socket);
  const isSocketConnected = useSocketStore((state) => state.isConnected);
  const phase = useCallStore((state) => state.phase);
  const call = useCallStore((state) => state.call);
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

  if (!isAuthenticated || phase === 'idle' || !call) {
    return null;
  }

  if (phase === 'reconnecting') {
    return (
      <ReconnectingOverlay
        remainingMs={reconnectRemainingMs}
        onRetry={() => void refreshRecoverableCall('manual')}
      />
    );
  }

  if (phase === 'ended') {
    return <EndedOverlay />;
  }

  if (isRinging) {
    return <RingingOverlay />;
  }

  if (call.type === 'video') {
    return <VideoCallOverlay />;
  }

  return <AudioCallOverlay />;
}

export default CallRoot;
