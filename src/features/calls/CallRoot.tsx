import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { callsApi } from '@/api/endpoints';
import type {
  CallActionPayload,
  CallAnswerPayload,
  CallDoc,
  CallIceCandidatePayload,
  CallOfferPayload,
  CallParticipantUpdatedEvent,
  CallSession,
  SocketErrorPayload,
  CallTerminalPayload,
} from '@/api/types';
import { useAuthStore } from '@/store/authStore';
import { EVENTS } from '@/socket/events';
import { useSocketStore } from '@/socket/socket';
import {
  attemptCallRecovery,
  continueAcknowledgedRecovery,
  expandCallView,
  handleAcceptedSession,
  handleAnswerSignal,
  handleConnectedSignal,
  handleIceCandidateSignal,
  handleIncomingSession,
  handleOfferSignal,
  handleParticipantUpdated,
  handleReconnectingCall,
  handleRecoveryExpired,
  handleRecoverySocketError,
  handleResumedSession,
  handleSocketDisconnected,
  handleTerminalCall,
  hydrateRecoverableCall,
  refreshCallDevices,
  resetCallController,
  useCallStore,
  type RecoverySource,
} from './callController';
import {
  initCallSounds,
  playCallStatusCue,
  stopCallSounds,
  syncCallToneLoop,
} from './callSounds';
import { ActiveCallView, MinimizedCallPip } from './components/CallActiveViews';
import { CallRemoteAudio } from './components/CallMedia';
import {
  EndedCallScreen,
  ReconnectingCallScreen,
  RingingCallScreen,
} from './components/CallStatusScreens';
import { useNotificationSoundStore, sendNotification } from '@/utils/notificationSound';

const CALL_RELOAD_RECOVERY_STORAGE_KEY = 'voicechat.call-reload-recovery';
const CALL_RELOAD_RECOVERY_TTL_MS = 30_000;
const CALL_RELOAD_RECOVERY_RETRY_MS = 1_500;

interface CallReloadRecoveryHint {
  callId: string;
  userId: string;
  capturedAt: number;
}

const isRecoverableCallForReload = (call: CallDoc | null | undefined) =>
  !!call &&
  call.is_live &&
  (call.status === 'accepted' ||
    call.status === 'connecting' ||
    call.status === 'active' ||
    call.status === 'reconnecting');

const clearCallReloadRecoveryHint = () => {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(CALL_RELOAD_RECOVERY_STORAGE_KEY);
};

const persistCallReloadRecoveryHint = (
  call: CallDoc | null | undefined,
  userId: string | null | undefined
) => {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') {
    return;
  }

  if (!isRecoverableCallForReload(call) || !userId) {
    clearCallReloadRecoveryHint();
    return;
  }

  const payload: CallReloadRecoveryHint = {
    callId: call.id,
    userId,
    capturedAt: Date.now(),
  };
  window.sessionStorage.setItem(
    CALL_RELOAD_RECOVERY_STORAGE_KEY,
    JSON.stringify(payload)
  );
};

const readCallReloadRecoveryHint = (
  userId: string | null | undefined
): CallReloadRecoveryHint | null => {
  if (
    typeof window === 'undefined' ||
    typeof window.sessionStorage === 'undefined' ||
    !userId
  ) {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(CALL_RELOAD_RECOVERY_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<CallReloadRecoveryHint>;
    if (
      typeof parsed.callId !== 'string' ||
      typeof parsed.userId !== 'string' ||
      typeof parsed.capturedAt !== 'number'
    ) {
      clearCallReloadRecoveryHint();
      return null;
    }

    if (
      parsed.userId !== userId ||
      Date.now() - parsed.capturedAt > CALL_RELOAD_RECOVERY_TTL_MS
    ) {
      clearCallReloadRecoveryHint();
      return null;
    }

    return {
      callId: parsed.callId,
      userId: parsed.userId,
      capturedAt: parsed.capturedAt,
    };
  } catch {
    clearCallReloadRecoveryHint();
    return null;
  }
};

export function CallRoot() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentUserId = useAuthStore((state) => state.userId);
  const socket = useSocketStore((state) => state.socket);
  const isSocketConnected = useSocketStore((state) => state.isConnected);
  const phase = useCallStore((state) => state.phase);
  const callPresentationMode = useCallStore((state) => state.callPresentationMode);
  const call = useCallStore((state) => state.call);
  const peerUser = useCallStore((state) => state.peerUser);
  const localStream = useCallStore((state) => state.localStream);
  const remoteStream = useCallStore((state) => state.remoteStream);
  const isResuming = useCallStore((state) => state.isResuming);
  const recoveryAcknowledged = useCallStore(
    (state) => state.recoveryAcknowledged
  );
  const soundEnabled = useNotificationSoundStore((state) => state.soundEnabled);
  const [now, setNow] = useState(() => Date.now());
  const [isDocumentHidden, setIsDocumentHidden] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'hidden'
  );
  const [callEventHandlersReady, setCallEventHandlersReady] = useState(false);
  const lastRecoveryCheckSocketIdRef = useRef<string | null>(null);
  const expiredCallIdRef = useRef<string | null>(null);
  const previousPhaseRef = useRef(phase);
  const notifiedIncomingCallIdRef = useRef<string | null>(null);
  const reloadRecoveryTimeoutIdRef = useRef<number | null>(null);
  const reloadRecoveryInFlightRef = useRef(false);
  const currentUserIdRef = useRef(currentUserId);
  const isAuthenticatedRef = useRef(isAuthenticated);
  const isSocketConnectedRef = useRef(isSocketConnected);
  const callEventHandlersReadyRef = useRef(callEventHandlersReady);

  const clearReloadRecoveryTimeout = () => {
    if (reloadRecoveryTimeoutIdRef.current !== null) {
      window.clearTimeout(reloadRecoveryTimeoutIdRef.current);
      reloadRecoveryTimeoutIdRef.current = null;
    }
  };

  const clearReloadRecoveryState = () => {
    clearReloadRecoveryTimeout();
    reloadRecoveryInFlightRef.current = false;
    clearCallReloadRecoveryHint();
  };

  const resumeCurrentRecovery = async (source: RecoverySource) => {
    const startedRecovery = await attemptCallRecovery(source);
    if (startedRecovery) {
      return true;
    }

    return continueAcknowledgedRecovery(source);
  };

  const isRecoverySettled = (callId: string) => {
    const state = useCallStore.getState();
    return (
      state.call?.id === callId &&
      (state.phase === 'connecting' ||
        state.phase === 'active' ||
        state.recoveryAcknowledged)
    );
  };

  const scheduleRecoveryRetry = (
    source: RecoverySource = 'socket-connect',
    delayMs = CALL_RELOAD_RECOVERY_RETRY_MS
  ) => {
    if (typeof window === 'undefined') {
      return;
    }

    const userId = currentUserIdRef.current;
    const recoveryHint = userId ? readCallReloadRecoveryHint(userId) : null;
    if (recoveryHint) {
      const remainingMs =
        CALL_RELOAD_RECOVERY_TTL_MS - (Date.now() - recoveryHint.capturedAt);
      if (remainingMs <= 0) {
        clearReloadRecoveryState();
        return;
      }

      clearReloadRecoveryTimeout();
      reloadRecoveryTimeoutIdRef.current = window.setTimeout(() => {
        void runReloadRecoveryAttempt();
      }, Math.min(delayMs, remainingMs));
      return;
    }

    clearReloadRecoveryTimeout();
    reloadRecoveryTimeoutIdRef.current = window.setTimeout(() => {
      const state = useCallStore.getState();
      if (state.phase === 'reconnecting' && !!state.call) {
        void resumeCurrentRecovery(source);
        return;
      }

      void refreshRecoverableCall(source, {
        attemptResume:
          useSocketStore.getState().isConnected &&
          callEventHandlersReadyRef.current,
        expireOnMissing: true,
      });
    }, delayMs);
  };

  const refreshRecoverableCall = async (
    source: RecoverySource,
    options: { attemptResume?: boolean; expireOnMissing?: boolean } = {}
  ) => {
    try {
      const session = await callsApi.getActive();

      if (!session) {
        clearReloadRecoveryState();
        if (
          options.expireOnMissing !== false &&
          useCallStore.getState().phase === 'reconnecting'
        ) {
          handleRecoveryExpired(
            source === 'manual'
              ? 'No recoverable call was found.'
              : 'The call could not be recovered.'
          );
        }
        return null;
      }

      hydrateRecoverableCall(session);
      if (options.attemptResume !== false) {
        await resumeCurrentRecovery(source);
      }
      return session;
    } catch (error) {
      console.error('Failed to fetch active call:', error);
      if (source === 'manual') {
        toast.error('Unable to check for a recoverable call right now.');
      }
      return null;
    }
  };

  const runReloadRecoveryAttempt = async () => {
    if (!isAuthenticatedRef.current || reloadRecoveryInFlightRef.current) {
      return;
    }

    const userId = currentUserIdRef.current;
    const recoveryHint = userId ? readCallReloadRecoveryHint(userId) : null;
    if (!recoveryHint) {
      clearReloadRecoveryTimeout();
      return;
    }

    const state = useCallStore.getState();
    if (isRecoverySettled(recoveryHint.callId)) {
      clearReloadRecoveryState();
      return;
    }

    if (
      state.phase !== 'idle' &&
      state.phase !== 'reconnecting' &&
      state.call?.id !== recoveryHint.callId
    ) {
      clearReloadRecoveryState();
      return;
    }

    reloadRecoveryInFlightRef.current = true;

    try {
      const session = await refreshRecoverableCall('page-load', {
        attemptResume:
          isSocketConnectedRef.current && callEventHandlersReadyRef.current,
        expireOnMissing: true,
      });

      if (!session) {
        return;
      }

      const latestHint = readCallReloadRecoveryHint(userId);
      if (!latestHint) {
        return;
      }

      if (isRecoverySettled(latestHint.callId)) {
        clearReloadRecoveryState();
        return;
      }

      scheduleRecoveryRetry('page-load');
    } finally {
      reloadRecoveryInFlightRef.current = false;
    }
  };

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    isSocketConnectedRef.current = isSocketConnected;
  }, [isSocketConnected]);

  useEffect(() => {
    callEventHandlersReadyRef.current = callEventHandlersReady;
  }, [callEventHandlersReady]);

  useEffect(() => {
    if (!isAuthenticated) {
      lastRecoveryCheckSocketIdRef.current = null;
      expiredCallIdRef.current = null;
      clearReloadRecoveryState();
      resetCallController();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserId) {
      return;
    }

    const recoveryHint = readCallReloadRecoveryHint(currentUserId);
    if (!recoveryHint) {
      return;
    }

    if (call?.id !== recoveryHint.callId) {
      return;
    }

    if (
      recoveryAcknowledged ||
      phase === 'connecting' ||
      phase === 'active' ||
      phase === 'ended' ||
      phase === 'failed'
    ) {
      clearReloadRecoveryState();
    }
  }, [
    call?.id,
    currentUserId,
    isAuthenticated,
    phase,
    recoveryAcknowledged,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const persistRecoveryHint = () => {
      const state = useCallStore.getState();
      persistCallReloadRecoveryHint(state.call, useAuthStore.getState().userId);
    };

    window.addEventListener('pagehide', persistRecoveryHint);
    window.addEventListener('beforeunload', persistRecoveryHint);

    return () => {
      window.removeEventListener('pagehide', persistRecoveryHint);
      window.removeEventListener('beforeunload', persistRecoveryHint);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      setIsDocumentHidden(document.visibilityState === 'hidden');
    };

    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    initCallSounds();
    return () => {
      stopCallSounds();
    };
  }, []);

  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    previousPhaseRef.current = phase;

    syncCallToneLoop(
      phase === 'incoming-ringing' && isDocumentHidden ? 'connecting' : phase
    );

    if (isDocumentHidden) {
      return;
    }

    if (
      phase === 'active' &&
      previousPhase !== 'active' &&
      previousPhase !== 'idle'
    ) {
      void playCallStatusCue('connected');
      return;
    }

    if (
      (phase === 'ended' || phase === 'failed') &&
      previousPhase !== phase &&
      previousPhase !== 'idle'
    ) {
      void playCallStatusCue('ended');
    }
  }, [isDocumentHidden, phase, soundEnabled]);

  useEffect(() => {
    if (phase !== 'incoming-ringing' || !call?.id) {
      return;
    }

    const notifyIncomingCall = () => {
      if (
        notifiedIncomingCallIdRef.current === call.id ||
        typeof document === 'undefined' ||
        document.visibilityState !== 'hidden'
      ) {
        return;
      }

      notifiedIncomingCallIdRef.current = call.id;

      const peerLabel =
        peerUser?.display_name ||
        peerUser?.username ||
        peerUser?.id ||
        'Someone';
      const callLabel = call.type === 'video' ? 'video' : 'audio';
      sendNotification(
        `Incoming ${callLabel} call`,
        `${peerLabel} is calling you.`,
        {
          playInAppCue: false,
          withSound: soundEnabled,
        }
      );
    };

    notifyIncomingCall();

    if (typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      notifyIncomingCall();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    call?.id,
    call?.type,
    peerUser?.display_name,
    peerUser?.id,
    peerUser?.username,
    phase,
    soundEnabled,
  ]);

  useEffect(() => {
    if (phase === 'idle') {
      notifiedIncomingCallIdRef.current = null;
    }
  }, [phase]);

  useEffect(() => {
    if (!isSocketConnected) {
      lastRecoveryCheckSocketIdRef.current = null;
    }
  }, [isSocketConnected]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserId) {
      clearReloadRecoveryTimeout();
      reloadRecoveryInFlightRef.current = false;
      return;
    }

    const recoveryHint = readCallReloadRecoveryHint(currentUserId);
    if (!recoveryHint) {
      clearReloadRecoveryTimeout();
      reloadRecoveryInFlightRef.current = false;
      return;
    }

    if (isSocketConnected && socket?.id && callEventHandlersReady) {
      lastRecoveryCheckSocketIdRef.current = socket.id;
    }

    void runReloadRecoveryAttempt();

    return () => {
      clearReloadRecoveryTimeout();
    };
  }, [callEventHandlersReady, currentUserId, isAuthenticated, isSocketConnected, socket?.id]);

  useEffect(() => {
    if (
      !isAuthenticated ||
      !isSocketConnected ||
      !socket?.id ||
      !callEventHandlersReady
    ) {
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
    if (state.phase === 'reconnecting' && !!state.call) {
      void resumeCurrentRecovery('socket-connect');
      return;
    }

    void refreshRecoverableCall('page-load');
  }, [callEventHandlersReady, isAuthenticated, isSocketConnected, socket?.id]);

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
    if (
      phase !== 'reconnecting' ||
      !call?.id ||
      reconnectRemainingMs === null ||
      reconnectRemainingMs > 0
    ) {
      return;
    }

    if (expiredCallIdRef.current === call.id) {
      return;
    }

    if (isResuming || reloadRecoveryInFlightRef.current) {
      return;
    }

    expiredCallIdRef.current = call.id;
    void refreshRecoverableCall('socket-connect', {
      attemptResume: isSocketConnected && callEventHandlersReady,
      expireOnMissing: true,
    });
  }, [
    call?.id,
    callEventHandlersReady,
    isResuming,
    isSocketConnected,
    phase,
    reconnectRemainingMs,
  ]);

  useEffect(() => {
    if (phase === 'reconnecting' && callPresentationMode === 'minimized') {
      expandCallView();
    }
  }, [callPresentationMode, phase]);

  useEffect(() => {
    if (
      !call?.id ||
      !localStream ||
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
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
      setCallEventHandlersReady(false);
      return;
    }

    const wrapAsync = <T,>(
      handler: (payload: T) => Promise<void> | void,
      label: string
    ) => {
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

    const handleIncoming = wrapAsync<CallSession>(
      handleIncomingSession,
      EVENTS.CALL_INCOMING
    );
    const handleAccepted = wrapAsync<CallSession>(
      handleAcceptedSession,
      EVENTS.CALL_ACCEPTED
    );
    const handleParticipantStateUpdated = wrapAsync<CallParticipantUpdatedEvent>(
      handleParticipantUpdated,
      EVENTS.CALL_PARTICIPANT_UPDATED
    );
    const handleRejected = wrapAsync<CallTerminalPayload>(
      async (payload) => {
        handleTerminalCall(payload);
        clearReloadRecoveryState();
      },
      EVENTS.CALL_REJECTED
    );
    const handleRecoveryAvailable = wrapAsync<CallSession>(
      async (payload) => {
        hydrateRecoverableCall(payload);
        await resumeCurrentRecovery('recovery-available');
      },
      EVENTS.CALL_RECOVERY_AVAILABLE
    );
    const handleOffer = wrapAsync<CallOfferPayload>(
      handleOfferSignal,
      EVENTS.CALL_OFFER
    );
    const handleAnswer = wrapAsync<CallAnswerPayload>(
      handleAnswerSignal,
      EVENTS.CALL_ANSWER
    );
    const handleIce = wrapAsync<CallIceCandidatePayload>(
      handleIceCandidateSignal,
      EVENTS.CALL_ICE_CANDIDATE
    );
    const handleConnected = wrapAsync<CallActionPayload>(
      handleConnectedSignal,
      EVENTS.CALL_CONNECTED
    );
    const handleReconnecting = wrapAsync<CallDoc>(
      handleReconnectingCall,
      EVENTS.CALL_RECONNECTING
    );
    const handleResumed = wrapAsync<CallSession>(
      handleResumedSession,
      EVENTS.CALL_RESUMED
    );
    const handleEnded = wrapAsync<CallTerminalPayload>(
      async (payload) => {
        handleTerminalCall(payload);
        clearReloadRecoveryState();
      },
      EVENTS.CALL_ENDED
    );
    const handleSocketError = (payload: SocketErrorPayload) => {
      if (!handleRecoverySocketError(payload)) {
        return;
      }

      scheduleRecoveryRetry('socket-connect');
    };
    const handleDisconnect = () => {
      handleSocketDisconnected();
    };

    socket.on(EVENTS.CALL_INCOMING, handleIncoming);
    socket.on(EVENTS.CALL_ACCEPTED, handleAccepted);
    socket.on(EVENTS.CALL_PARTICIPANT_UPDATED, handleParticipantStateUpdated);
    socket.on(EVENTS.CALL_REJECTED, handleRejected);
    socket.on(EVENTS.CALL_RECOVERY_AVAILABLE, handleRecoveryAvailable);
    socket.on(EVENTS.CALL_OFFER, handleOffer);
    socket.on(EVENTS.CALL_ANSWER, handleAnswer);
    socket.on(EVENTS.CALL_ICE_CANDIDATE, handleIce);
    socket.on(EVENTS.CALL_CONNECTED, handleConnected);
    socket.on(EVENTS.CALL_RECONNECTING, handleReconnecting);
    socket.on(EVENTS.CALL_RESUMED, handleResumed);
    socket.on(EVENTS.CALL_ENDED, handleEnded);
    socket.on(EVENTS.ERROR, handleSocketError);
    socket.on(EVENTS.DISCONNECT, handleDisconnect);
    setCallEventHandlersReady(true);

    return () => {
      setCallEventHandlersReady(false);
      socket.off(EVENTS.CALL_INCOMING, handleIncoming);
      socket.off(EVENTS.CALL_ACCEPTED, handleAccepted);
      socket.off(EVENTS.CALL_PARTICIPANT_UPDATED, handleParticipantStateUpdated);
      socket.off(EVENTS.CALL_REJECTED, handleRejected);
      socket.off(EVENTS.CALL_RECOVERY_AVAILABLE, handleRecoveryAvailable);
      socket.off(EVENTS.CALL_OFFER, handleOffer);
      socket.off(EVENTS.CALL_ANSWER, handleAnswer);
      socket.off(EVENTS.CALL_ICE_CANDIDATE, handleIce);
      socket.off(EVENTS.CALL_CONNECTED, handleConnected);
      socket.off(EVENTS.CALL_RECONNECTING, handleReconnecting);
      socket.off(EVENTS.CALL_RESUMED, handleResumed);
      socket.off(EVENTS.CALL_ENDED, handleEnded);
      socket.off(EVENTS.ERROR, handleSocketError);
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
  const remoteAudio =
    !isRinging && phase !== 'ended' ? <CallRemoteAudio stream={remoteStream} /> : null;

  if (!isAuthenticated || phase === 'idle' || !call) {
    return null;
  }

  if (phase === 'reconnecting') {
    return (
      <>
        {remoteAudio}
        <ReconnectingCallScreen
          remainingMs={reconnectRemainingMs}
          onRetry={() => void refreshRecoverableCall('manual')}
        />
      </>
    );
  }

  if (phase === 'ended') {
    return <EndedCallScreen />;
  }

  if (isRinging) {
    return <RingingCallScreen />;
  }

  if (isMinimized) {
    return (
      <>
        {remoteAudio}
        <MinimizedCallPip />
      </>
    );
  }

  return (
    <>
      {remoteAudio}
      <ActiveCallView isVideoCall={call.type === 'video'} />
    </>
  );
}

export default CallRoot;
