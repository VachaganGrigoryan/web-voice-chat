import { toast } from 'sonner';
import { callsApi } from '@/api/endpoints';
import {
  AcceptCallRequest,
  CallActionPayload,
  CallAnswerPayload,
  CallDoc,
  CallIceCandidatePayload,
  CallMediaStatePayload,
  CallOfferPayload,
  CallParticipantState,
  CallParticipantUpdatedEvent,
  CallPeerUserSummary,
  CallSession,
  CallTerminalPayload,
  CallType,
  IceServer,
  SocketErrorPayload,
} from '@/api/types';
import { extractApiError } from '@/api/errors';
import { useAuthStore } from '@/store/authStore';
import { EVENTS } from '@/socket/events';
import { useSocketStore } from '@/socket/socket';
import { ICE_DISCONNECT_GRACE_MS, TERMINAL_REST_FALLBACK_TIMEOUT_MS, END_SCREEN_DURATION_MS } from './callConfig';
import {
  createInitialDeviceState,
  getCallState,
  rememberExpandedSelfPreviewPlacement,
  resetCallStore,
  setCallState,
  type CallControllerState,
  type CallExpandedSelfPreviewPlacement,
  type CallPhase,
  type CallRole,
  type LocalTerminalAction,
  type MediaPreferences,
  type MinimizedCallPosition,
  type RecoverySource,
} from './callStore';
import {
  getExposedCallCameras,
  getTrackDeviceId,
  getVideoConstraints,
  isExactDeviceConstraintError,
  resolveExposedCameraId,
  resolveCallDeviceState,
  supportsBrowserAudioOutputSelection,
  toCallMediaDevices,
  type HTMLAudioElementWithSinkId,
} from './callDevices';
import {
  type CallPreferredDeviceIds,
  writeCallDevicePreferences,
} from './callDevicePreferences';
import { primeCallSoundFromUserGesture } from './callSounds';

/*
 * CALL STATE MACHINE
 * ==================
 * Phases and their valid transitions:
 *
 *   idle
 *    ├──[startCall]──────────────► outgoing-ringing
 *    └──[handleIncomingSession]──► incoming-ringing
 *
 *   outgoing-ringing
 *    ├──[handleAcceptedSession]──► connecting
 *    ├──[handleTerminalCall]─────► ended / failed
 *    └──[endCurrentCall]─────────► ending → idle
 *
 *   incoming-ringing
 *    ├──[acceptIncomingCall]─────► connecting
 *    ├──[rejectIncomingCall]─────► ending → idle
 *    └──[handleTerminalCall]─────► ended / failed
 *
 *   connecting
 *    ├──[handleConnectedSignal]──► active
 *    ├──[ICE disconnect + grace]─► reconnecting
 *    └──[handleTerminalCall]─────► ended / failed
 *
 *   active
 *    ├──[ICE disconnect + grace]─► reconnecting
 *    ├──[endCurrentCall]─────────► ending → idle
 *    └──[handleTerminalCall]─────► ended / failed
 *
 *   reconnecting
 *    ├──[handleResumedSession]───► connecting
 *    ├──[attemptCallRecovery]────► reconnecting (retry)
 *    ├──[handleRecoveryExpired]──► idle
 *    └──[handleTerminalCall]─────► ended / failed
 *
 *   ending  (local terminal action in-flight, waiting for server ack)
 *    └──[ack / fallback timeout]─► idle
 *
 *   ended / failed  (terminal display)
 *    └──[END_SCREEN_DURATION_MS]─► idle
 *
 * Recovery entry points (see attemptCallRecovery for details):
 *   'page-load' | 'socket-connect' | 'manual' | 'recovery-available'
 *
 * Roles:
 *   caller — initiates the call, sends the SDP offer
 *   callee — receives the call, sends the SDP answer
 */

interface StartCallInput {
  peerUserId: string;
  type: CallType;
  peerUser?: Partial<CallPeerUserSummary> | null;
}

let nextTerminalActionId = 0;
const backgroundRejectFallbackTimeouts = new Map<string, number>();
let remoteAudioElement: HTMLAudioElementWithSinkId | null = null;

const getSocket = () => useSocketStore.getState().socket;
const isSocketConnected = () => !!getSocket()?.connected;
const getCurrentUserId = () => useAuthStore.getState().userId;
const RECOVERABLE_RESUME_ERROR_CODES = new Set([
  'CALL_EXPIRED',
  'CALL_NOT_FOUND',
  'CALL_NOT_RECOVERABLE',
  'INVALID_CALL_STATE',
]);


const isRecoverableStatus = (status: CallDoc['status']) =>
  status === 'accepted' ||
  status === 'connecting' ||
  status === 'active' ||
  status === 'reconnecting';

const isRecoverableCall = (call: CallDoc | null | undefined) =>
  !!call && isRecoverableStatus(call.status);

const isMinimizableCallPhase = (phase: CallPhase) =>
  phase === 'connecting' || phase === 'active';

const isTerminalStatus = (status: CallDoc['status']) =>
  status === 'rejected' ||
  status === 'cancelled' ||
  status === 'expired' ||
  status === 'ended';

const defaultMediaPreferencesForCall = (callType: CallType): MediaPreferences => ({
  micMuted: false,
  cameraEnabled: callType === 'video',
});

const getRoleForCall = (call: CallDoc): CallRole => {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) {
    return null;
  }

  if (call.caller_user_id === currentUserId) {
    return 'caller';
  }

  if (call.callee_user_id === currentUserId) {
    return 'callee';
  }

  return null;
};

const getPeerUserIdForCall = (call: CallDoc) => {
  const currentUserId = getCurrentUserId();
  if (!currentUserId) {
    return null;
  }

  return call.caller_user_id === currentUserId ? call.callee_user_id : call.caller_user_id;
};

const getParticipantState = (
  call: CallDoc | null | undefined,
  userId: string | null | undefined
): CallParticipantState | null => {
  if (!call || !userId) {
    return null;
  }

  return call.participant_states?.[userId] || null;
};

const getCurrentParticipantState = (call: CallDoc | null | undefined) =>
  getParticipantState(call, getCurrentUserId());

const isPeerDisconnected = (call: CallDoc | null | undefined) => {
  if (!call) {
    return false;
  }

  const peerUserId = getPeerUserIdForCall(call);
  return !!peerUserId && call.disconnected_user_ids.includes(peerUserId);
};

const buildPeerUserSummary = (
  peerUserId: string,
  peerUser?: Partial<CallPeerUserSummary> | null
): CallPeerUserSummary => ({
  id: peerUserId,
  username: peerUser?.username || '',
  display_name: peerUser?.display_name ?? null,
  avatar: (peerUser?.avatar as CallPeerUserSummary['avatar'] | undefined) ?? null,
  is_online: peerUser?.is_online ?? false,
});

const emitCallEvent = (event: string, payload: unknown) => {
  getSocket()?.emit(event, payload);
};

const emitCallJoin = (callId: string) => {
  emitCallEvent(EVENTS.CALL_JOIN, { call_id: callId } satisfies CallActionPayload);
};

const updateCurrentCall = (patch: Partial<CallDoc>) => {
  const currentCall = getCallState().call;
  if (!currentCall) {
    return;
  }

  setCallState({
    call: {
      ...currentCall,
      ...patch,
    },
  });
};

const stopStreamTracks = (stream: MediaStream | null) => {
  stream?.getTracks().forEach((track) => track.stop());
};

const clearDisconnectTimeout = () => {
  const timeoutId = getCallState().disconnectTimeoutId;
  if (timeoutId !== null) {
    window.clearTimeout(timeoutId);
    setCallState({ disconnectTimeoutId: null });
  }
};

const clearTerminalFallbackTimeout = () => {
  const timeoutId = getCallState().terminalFallbackTimeoutId;
  if (timeoutId !== null) {
    window.clearTimeout(timeoutId);
    setCallState({ terminalFallbackTimeoutId: null });
  }
};

const clearBackgroundRejectFallback = (callId: string) => {
  const timeoutId = backgroundRejectFallbackTimeouts.get(callId);
  if (timeoutId !== undefined) {
    window.clearTimeout(timeoutId);
    backgroundRejectFallbackTimeouts.delete(callId);
  }
};

const clearTerminalDisplayTimeout = () => {
  const timeoutId = getCallState().terminalDisplayTimeoutId;
  if (timeoutId !== null) {
    window.clearTimeout(timeoutId);
    setCallState({ terminalDisplayTimeoutId: null });
  }
};

const disposePeerConnection = (peerConnection: RTCPeerConnection | null) => {
  if (!peerConnection) {
    return;
  }

  peerConnection.ontrack = null;
  peerConnection.onicecandidate = null;
  peerConnection.oniceconnectionstatechange = null;
  peerConnection.onconnectionstatechange = null;

  if (peerConnection.signalingState !== 'closed') {
    peerConnection.close();
  }
};

const clearPeerConnectionState = (
  preserveLocalStream: boolean,
  options: { preservePendingSignals?: boolean } = {}
) => {
  const state = getCallState();
  disposePeerConnection(state.peerConnection);
  stopStreamTracks(state.remoteStream);

  if (!preserveLocalStream) {
    stopStreamTracks(state.localStream);
  }

  setCallState({
    peerConnection: null,
    remoteStream: null,
    pendingRemoteOffer: options.preservePendingSignals
      ? state.pendingRemoteOffer
      : null,
    pendingRemoteAnswer: options.preservePendingSignals
      ? state.pendingRemoteAnswer
      : null,
    pendingIceCandidates: options.preservePendingSignals
      ? state.pendingIceCandidates
      : [],
    hasSentInitialOffer: false,
    hasEmittedConnected: false,
    ...(preserveLocalStream ? {} : { localStream: null }),
  });
};

const resetCallState = () => {
  clearDisconnectTimeout();
  clearTerminalFallbackTimeout();
  clearTerminalDisplayTimeout();
  clearPeerConnectionState(false);
  resetCallStore();
};

const prepareRecoveryReset = (
  options: { preserveRecoveryAcknowledged?: boolean } = {}
) => {
  clearDisconnectTimeout();
  clearTerminalFallbackTimeout();
  clearTerminalDisplayTimeout();
  clearPeerConnectionState(true, { preservePendingSignals: true });
  const state = getCallState();
  if (!state.call) {
    return;
  }

  setCallState({
    phase: 'reconnecting',
    callPresentationMode: 'expanded',
    minimizedCallPosition: null,
    call: {
      ...state.call,
      status: 'reconnecting',
    },
    isStarting: false,
    isAccepting: false,
    isEnding: false,
    recoveryAcknowledged: options.preserveRecoveryAcknowledged
      ? state.recoveryAcknowledged
      : false,
    localTerminalAction: null,
    pendingTerminalActionId: null,
    endScreenMessage: null,
  });
};

const failAndResetCall = (message: string) => {
  toast.error(message);
  resetCallState();
};

const setRecoveryError = (message: string, toastError = false) => {
  const state = getCallState();
  if (!state.call) {
    if (toastError) {
      toast.error(message);
    }
    resetCallState();
    return;
  }

  prepareRecoveryReset();
  const nextRole = state.role || getRoleForCall(state.call);
  setCallState({
    role: nextRole,
    error: message,
    isResuming: false,
    resumeSource: null,
    recoveryAcknowledged: false,
    needsRecoveryOffer: nextRole === 'caller',
  });

  if (toastError) {
    toast.error(message);
  }
};

const finalizeTerminalCall = (
  callDoc: CallDoc | null,
  options: {
    fallbackMessage?: string | null;
    suppressToast?: boolean;
  } = {}
) => {
  const { call, peerUser } = getCallState();
  if (!call) {
    resetCallState();
    return;
  }

  if (callDoc && callDoc.id !== call.id) {
    return;
  }

  if (!options.suppressToast) {
    const message =
      options.fallbackMessage ??
      (callDoc ? getTerminalCallMessage(callDoc, peerUser) : null);
    if (message) {
      toast.info(message);
    }
  }

  resetCallState();
};

const normalizeTerminalPayload = (payload: CallTerminalPayload) => {
  if ('call' in payload) {
    return {
      call: payload.call,
      peerUser: payload.peer_user,
    };
  }

  return {
    call: payload,
    peerUser: null,
  };
};

const showTerminalCallScreen = (
  callDoc: CallDoc,
  peerUserOverride: CallPeerUserSummary | null = null
) => {
  const state = getCallState();
  if (!state.call || state.call.id !== callDoc.id) {
    return;
  }

  clearDisconnectTimeout();
  clearTerminalFallbackTimeout();
  clearTerminalDisplayTimeout();
  clearPeerConnectionState(false);

  const peerUser = peerUserOverride ?? state.peerUser;
  const endScreenMessage = getTerminalCallMessage(callDoc, peerUser) || 'The call ended.';
  const timeoutId = window.setTimeout(() => {
    const latestState = getCallState();
    if (latestState.call?.id !== callDoc.id || latestState.phase !== 'ended') {
      return;
    }

    resetCallState();
  }, END_SCREEN_DURATION_MS);

  setCallState({
    phase: 'ended',
    callPresentationMode: 'expanded',
    minimizedCallPosition: null,
    call: callDoc,
    peerUser,
    isStarting: false,
    isAccepting: false,
    isEnding: false,
    isResuming: false,
    resumeSource: null,
    recoveryAcknowledged: false,
    localTerminalAction: null,
    terminalFallbackTimeoutId: null,
    pendingTerminalActionId: null,
    endScreenMessage,
    terminalDisplayTimeoutId: timeoutId,
    error: null,
  });
};

const beginEndingCall = (
  action: Exclude<LocalTerminalAction, null>
): { call: CallDoc; actionId: number } | null => {
  const state = getCallState();
  if (!state.call || state.phase === 'idle' || state.phase === 'ending' || !!state.localTerminalAction) {
    return null;
  }

  clearDisconnectTimeout();
  clearTerminalFallbackTimeout();

  const callId = state.call.id;
  const actionId = ++nextTerminalActionId;

  setCallState({
    phase: 'ending',
    callPresentationMode: 'expanded',
    minimizedCallPosition: null,
    isEnding: true,
    isStarting: false,
    isAccepting: false,
    isResuming: false,
    resumeSource: null,
    recoveryAcknowledged: false,
    localTerminalAction: action,
    terminalFallbackTimeoutId: null,
    pendingTerminalActionId: actionId,
    endScreenMessage: null,
    error: null,
  });

  return {
    call: state.call,
    actionId,
  };
};

const isPendingTerminalAction = (
  callId: string,
  action: Exclude<LocalTerminalAction, null>,
  actionId: number
) => {
  const state = getCallState();
  return (
    state.call?.id === callId &&
    state.localTerminalAction === action &&
    state.pendingTerminalActionId === actionId
  );
};

const runTerminalRestFallback = async (
  callId: string,
  action: Exclude<LocalTerminalAction, null>,
  actionId: number
) => {
  clearTerminalFallbackTimeout();

  if (!isPendingTerminalAction(callId, action, actionId)) {
    return;
  }

  try {
    const callDoc =
      action === 'reject'
        ? await callsApi.reject(callId)
        : await callsApi.end(callId);

    if (!isPendingTerminalAction(callId, action, actionId)) {
      return;
    }

    finalizeTerminalCall(callDoc, { suppressToast: true });
  } catch (error) {
    if (!isPendingTerminalAction(callId, action, actionId)) {
      return;
    }

    toast.error(
      extractApiError(
        error,
        action === 'reject' ? 'Unable to reject the call.' : 'Unable to end the call.'
      )
    );
    resetCallState();
  }
};

const scheduleTerminalRestFallback = (
  callId: string,
  action: Exclude<LocalTerminalAction, null>,
  actionId: number
) => {
  clearTerminalFallbackTimeout();

  const timeoutId = window.setTimeout(() => {
    void runTerminalRestFallback(callId, action, actionId);
  }, TERMINAL_REST_FALLBACK_TIMEOUT_MS);

  setCallState({ terminalFallbackTimeoutId: timeoutId });
};

const performSocketPrimaryTerminalAction = async (
  action: Exclude<LocalTerminalAction, null>,
  socketEvent: typeof EVENTS.CALL_REJECT | typeof EVENTS.CALL_HANGUP
) => {
  const started = beginEndingCall(action);
  if (!started) {
    return;
  }

  const {
    call: currentCall,
    actionId,
  } = started;

  if (!isSocketConnected()) {
    await runTerminalRestFallback(currentCall.id, action, actionId);
    return;
  }

  emitCallEvent(socketEvent, { call_id: currentCall.id } satisfies CallActionPayload);
  scheduleTerminalRestFallback(currentCall.id, action, actionId);
};

const rejectCallWithSocketFallback = (callId: string) => {
  clearBackgroundRejectFallback(callId);

  if (!isSocketConnected()) {
    void safeRejectCallRequest(callId);
    return;
  }

  emitCallEvent(EVENTS.CALL_REJECT, { call_id: callId } satisfies CallActionPayload);

  const timeoutId = window.setTimeout(() => {
    backgroundRejectFallbackTimeouts.delete(callId);
    void safeRejectCallRequest(callId);
  }, TERMINAL_REST_FALLBACK_TIMEOUT_MS);

  backgroundRejectFallbackTimeouts.set(callId, timeoutId);
};

const toRtcIceServers = (iceServers: IceServer[]): RTCIceServer[] =>
  iceServers.map((server) => ({
    urls: server.urls,
    username: server.username || undefined,
    credential: server.credential || undefined,
  }));

const syncStoredDevicePreferences = (
  patch: Partial<CallPreferredDeviceIds>
): CallPreferredDeviceIds => {
  const nextPreferences = writeCallDevicePreferences(patch);
  setCallState({
    preferredMicrophoneId: nextPreferences.microphoneId,
    preferredCameraId: nextPreferences.cameraId,
    preferredAudioRouteId: nextPreferences.audioRouteId,
  });
  return nextPreferences;
};

const getRequestedMicrophoneId = (
  state: Pick<
    CallControllerState,
    'selectedMicrophoneId' | 'preferredMicrophoneId'
  >
) => state.selectedMicrophoneId || state.preferredMicrophoneId;

const getRequestedCameraId = (
  state: Pick<
    CallControllerState,
    'selectedCameraId' | 'preferredCameraId'
  >
) => state.selectedCameraId || state.preferredCameraId;

const getLocalStreamConstraints = (
  callType: CallType,
  state: Pick<
    CallControllerState,
    | 'selectedMicrophoneId'
    | 'selectedCameraId'
    | 'preferredMicrophoneId'
    | 'preferredCameraId'
  >,
  requestedCameraId = getRequestedCameraId(state)
): MediaStreamConstraints => ({
  audio: getRequestedMicrophoneId(state)
    ? { deviceId: { exact: getRequestedMicrophoneId(state)! } }
    : true,
  video:
    callType === 'video'
      ? getVideoConstraints(requestedCameraId)
      : false,
});

const applyBrowserAudioOutputToElement = async (
  routeId: string | null,
  options: { showToast?: boolean } = {}
) => {
  if (!routeId || !remoteAudioElement || !supportsBrowserAudioOutputSelection()) {
    return;
  }

  try {
    await remoteAudioElement.setSinkId?.(routeId);
  } catch (error) {
    if (options.showToast) {
      toast.error('This browser could not switch the audio output.');
    }

    throw error;
  }
};

const syncAvailableCallDevices = (devices: MediaDeviceInfo[]) => {
  const state = getCallState();
  const {
    normalizedPreferredCameraId,
    ...resolvedDeviceState
  } = resolveCallDeviceState(state, devices);
  let nextPreferences: CallPreferredDeviceIds = {
    microphoneId: state.preferredMicrophoneId,
    cameraId: normalizedPreferredCameraId,
    audioRouteId: state.preferredAudioRouteId,
  };

  const missingPreferencePatch: Partial<CallPreferredDeviceIds> = {};
  if (
    state.preferredMicrophoneId &&
    !resolvedDeviceState.availableMicrophones.some(
      (device) => device.id === state.preferredMicrophoneId
    )
  ) {
    missingPreferencePatch.microphoneId = null;
  }

  if (state.preferredCameraId && normalizedPreferredCameraId !== state.preferredCameraId) {
    missingPreferencePatch.cameraId = normalizedPreferredCameraId;
  }

  if (
    state.preferredAudioRouteId &&
    !resolvedDeviceState.availableAudioRoutes.some(
      (route) => route.id === state.preferredAudioRouteId
    )
  ) {
    missingPreferencePatch.audioRouteId = null;
  }

  if (Object.keys(missingPreferencePatch).length) {
    nextPreferences = writeCallDevicePreferences(missingPreferencePatch);
  }

  setCallState({
    ...resolvedDeviceState,
    preferredMicrophoneId: nextPreferences.microphoneId,
    preferredCameraId: nextPreferences.cameraId,
    preferredAudioRouteId: nextPreferences.audioRouteId,
  });

  if (resolvedDeviceState.selectedAudioRouteId) {
    void applyBrowserAudioOutputToElement(
      resolvedDeviceState.selectedAudioRouteId
    ).catch(() => {});
  }
};

const normalizeRequestedCameraId = async (
  state: Pick<
    CallControllerState,
    'selectedCameraId' | 'preferredCameraId'
  >
) => {
  const requestedCameraId = getRequestedCameraId(state);
  if (
    !requestedCameraId ||
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices?.enumerateDevices
  ) {
    return requestedCameraId;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = toCallMediaDevices(devices, 'videoinput');
    const normalizedCameraId = resolveExposedCameraId({
      cameras,
      exposedCameras: getExposedCallCameras(cameras),
      cameraId: requestedCameraId,
    });

    if (!normalizedCameraId || normalizedCameraId === requestedCameraId) {
      return requestedCameraId;
    }

    const nextState: Pick<
      CallControllerState,
      'selectedCameraId' | 'preferredCameraId'
    > = {
      selectedCameraId:
        state.selectedCameraId === requestedCameraId
          ? normalizedCameraId
          : state.selectedCameraId,
      preferredCameraId: state.preferredCameraId,
    };

    if (state.preferredCameraId === requestedCameraId) {
      const nextPreferences = syncStoredDevicePreferences({
        cameraId: normalizedCameraId,
      });
      nextState.preferredCameraId = nextPreferences.cameraId;
    }

    setCallState(nextState);
    return normalizedCameraId;
  } catch (error) {
    console.error('Failed to normalize requested camera:', error);
    return requestedCameraId;
  }
};

export const refreshCallDevices = async () => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    setCallState({
      ...createInitialDeviceState(),
    });
    return;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    syncAvailableCallDevices(devices);
  } catch (error) {
    console.error('Failed to enumerate call devices:', error);
  }
};

export const registerCallRemoteAudioElement = (node: HTMLAudioElement | null) => {
  remoteAudioElement = node as HTMLAudioElementWithSinkId | null;

  if (remoteAudioElement) {
    void applyBrowserAudioOutputToElement(getCallState().selectedAudioRouteId).catch(() => {});
  }
};

const syncMediaPreferenceState = (callType: CallType, preferences: MediaPreferences) => {
  setCallState({
    mediaPreferences: {
      micMuted: preferences.micMuted,
      cameraEnabled: callType === 'video' ? preferences.cameraEnabled : false,
    },
    isMicMuted: preferences.micMuted,
    isCameraEnabled: callType === 'video' ? preferences.cameraEnabled : false,
  });
};

const applyMediaPreferencesToStream = (
  stream: MediaStream,
  callType: CallType,
  preferences: MediaPreferences
) => {
  stream.getAudioTracks().forEach((track) => {
    track.enabled = !preferences.micMuted;
  });

  stream.getVideoTracks().forEach((track) => {
    track.enabled = callType === 'video' ? preferences.cameraEnabled : false;
  });
};

const getMediaPreferencesFromCall = (
  call: CallDoc,
  fallback = defaultMediaPreferencesForCall(call.type)
): MediaPreferences => {
  const participantState = getCurrentParticipantState(call);
  if (!participantState) {
    return fallback;
  }

  return {
    micMuted: !participantState.audio_enabled,
    cameraEnabled: call.type === 'video' ? participantState.video_enabled : false,
  };
};

const syncCurrentParticipantMediaState = (
  call: CallDoc,
  options: { applyToLocalStream?: boolean } = {}
) => {
  const state = getCallState();
  const nextPreferences = getMediaPreferencesFromCall(call, state.mediaPreferences);

  if (options.applyToLocalStream !== false && state.localStream) {
    applyMediaPreferencesToStream(state.localStream, call.type, nextPreferences);
  }

  syncMediaPreferenceState(call.type, nextPreferences);
};

const applySessionSnapshot = (
  session: Pick<CallSession, 'call' | 'peer_user' | 'ice_servers'>,
  options: { syncLocalMedia?: boolean } = {}
) => {
  const state = getCallState();
  setCallState({
    call: session.call,
    peerUser: session.peer_user,
    iceServers: session.ice_servers.length ? session.ice_servers : state.iceServers,
  });

  if (options.syncLocalMedia !== false) {
    syncCurrentParticipantMediaState(session.call);
  }
};

const emitCurrentParticipantMediaState = (
  patch: Omit<CallMediaStatePayload, 'call_id'>
) => {
  const call = getCallState().call;
  if (!call) {
    return;
  }

  emitCallEvent(EVENTS.CALL_MEDIA_STATE, {
    call_id: call.id,
    ...patch,
  } satisfies CallMediaStatePayload);
};

const hasLiveTracks = (tracks: MediaStreamTrack[]) =>
  tracks.some((track) => track.readyState === 'live');

const hasReusableLocalStream = (stream: MediaStream | null, callType: CallType) => {
  if (!stream) {
    return false;
  }

  const hasAudio = hasLiveTracks(stream.getAudioTracks());
  const hasVideo = callType === 'video' ? hasLiveTracks(stream.getVideoTracks()) : true;

  return hasAudio && hasVideo;
};

const clearStoredInputPreference = (kind: 'audio' | 'video') => {
  syncStoredDevicePreferences(
    kind === 'audio'
      ? { microphoneId: null }
      : { cameraId: null }
  );
};

const requestLocalStream = async (callType: CallType, state: CallControllerState) => {
  const requestedCameraId =
    callType === 'video' ? await normalizeRequestedCameraId(state) : null;
  const constraints = getLocalStreamConstraints(callType, state, requestedCameraId);

  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (error) {
    const selectedDeviceRequested =
      !!getRequestedMicrophoneId(state) ||
      (callType === 'video' && !!requestedCameraId);
    if (!selectedDeviceRequested || !isExactDeviceConstraintError(error)) {
      throw error;
    }

    if (getRequestedMicrophoneId(state)) {
      clearStoredInputPreference('audio');
    }

    if (callType === 'video' && getRequestedCameraId(state)) {
      clearStoredInputPreference('video');
    }

    setCallState({
      selectedMicrophoneId: null,
      selectedCameraId: null,
    });

    return navigator.mediaDevices.getUserMedia(
      callType === 'video'
        ? { audio: true, video: getVideoConstraints() }
        : { audio: true, video: false }
    );
  }
};

const acquireLocalStream = async (
  callType: CallType,
  options: { reuseExisting: boolean } = { reuseExisting: true }
) => {
  const state = getCallState();
  const preferences = state.mediaPreferences;

  if (options.reuseExisting && hasReusableLocalStream(state.localStream, callType)) {
    applyMediaPreferencesToStream(state.localStream!, callType, preferences);
    syncMediaPreferenceState(callType, preferences);
    await refreshCallDevices();
    return state.localStream!;
  }

  if (state.localStream) {
    stopStreamTracks(state.localStream);
    setCallState({ localStream: null });
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Media devices are not available in this browser.');
  }

  const stream = await requestLocalStream(callType, state);

  applyMediaPreferencesToStream(stream, callType, preferences);
  setCallState({
    localStream: stream,
    selectedMicrophoneId: getTrackDeviceId(stream.getAudioTracks()[0]),
    selectedCameraId: callType === 'video' ? getTrackDeviceId(stream.getVideoTracks()[0]) : null,
  });
  syncMediaPreferenceState(callType, preferences);
  await refreshCallDevices();

  return stream;
};

const requestReplacementTrack = async (
  kind: 'audio' | 'video',
  deviceId: string
): Promise<MediaStreamTrack> => {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Media devices are not available in this browser.');
  }

  const constraints: MediaStreamConstraints =
    kind === 'audio'
      ? { audio: { deviceId: { exact: deviceId } }, video: false }
      : { audio: false, video: getVideoConstraints(deviceId) };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const track = kind === 'audio' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];
    if (!track) {
      stopStreamTracks(stream);
      throw new Error(`The selected ${kind === 'audio' ? 'microphone' : 'camera'} did not provide a track.`);
    }

    return track;
  } catch (error) {
    if (!isExactDeviceConstraintError(error)) {
      throw error;
    }

    clearStoredInputPreference(kind);

    const fallbackStream = await navigator.mediaDevices.getUserMedia(
      kind === 'audio'
        ? { audio: true, video: false }
        : { audio: false, video: getVideoConstraints() }
    );
    const fallbackTrack = kind === 'audio'
      ? fallbackStream.getAudioTracks()[0]
      : fallbackStream.getVideoTracks()[0];

    if (!fallbackTrack) {
      stopStreamTracks(fallbackStream);
      throw new Error(`The browser could not access a fallback ${kind === 'audio' ? 'microphone' : 'camera'}.`);
    }

    return fallbackTrack;
  }
};

const replaceLocalTrack = async (kind: 'audio' | 'video', deviceId: string) => {
  const state = getCallState();
  const { localStream, mediaPreferences, peerConnection } = state;
  if (!localStream) {
    return;
  }

  const nextTrack = await requestReplacementTrack(kind, deviceId);
  const previousTrack =
    kind === 'audio'
      ? localStream.getAudioTracks()[0] || null
      : localStream.getVideoTracks()[0] || null;
  const nextStream = new MediaStream([
    ...localStream.getTracks().filter((track) => track.kind !== kind),
    nextTrack,
  ]);
  const sender = peerConnection?.getSenders().find((candidate) => candidate.track?.kind === kind) || null;

  if (sender) {
    await sender.replaceTrack(nextTrack);
  } else if (peerConnection) {
    peerConnection.addTrack(nextTrack, nextStream);
  }

  applyMediaPreferencesToStream(nextStream, state.call?.type || 'audio', mediaPreferences);
  const resolvedTrackDeviceId = getTrackDeviceId(nextTrack) || deviceId;
  const nextPreferences =
    kind === 'audio'
      ? syncStoredDevicePreferences({ microphoneId: resolvedTrackDeviceId })
      : syncStoredDevicePreferences({ cameraId: resolvedTrackDeviceId });
  setCallState({
    localStream: nextStream,
    selectedMicrophoneId:
      kind === 'audio'
        ? resolvedTrackDeviceId
        : state.selectedMicrophoneId,
    selectedCameraId:
      kind === 'video'
        ? resolvedTrackDeviceId
        : state.selectedCameraId,
    preferredMicrophoneId:
      kind === 'audio'
        ? nextPreferences.microphoneId
        : state.preferredMicrophoneId,
    preferredCameraId:
      kind === 'video'
        ? nextPreferences.cameraId
        : state.preferredCameraId,
  });

  previousTrack?.stop();
  await refreshCallDevices();
};

const addLocalTracks = (peerConnection: RTCPeerConnection, localStream: MediaStream) => {
  const senderKinds = new Set(
    peerConnection
      .getSenders()
      .map((sender) => sender.track?.kind)
      .filter((kind): kind is 'audio' | 'video' => kind === 'audio' || kind === 'video')
  );

  localStream.getTracks().forEach((track) => {
    if (!senderKinds.has(track.kind as 'audio' | 'video')) {
      peerConnection.addTrack(track, localStream);
    }
  });
};

const flushPendingIceCandidates = async (peerConnection: RTCPeerConnection) => {
  const { pendingIceCandidates } = getCallState();
  if (!pendingIceCandidates.length || !peerConnection.remoteDescription) {
    return;
  }

  for (const candidate of pendingIceCandidates) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  setCallState({ pendingIceCandidates: [] });
};

const applyRemoteDescription = async (
  peerConnection: RTCPeerConnection,
  description: RTCSessionDescriptionInit
) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(description));
  await flushPendingIceCandidates(peerConnection);
};

const markCallAsConnecting = () => {
  const state = getCallState();
  const currentCall = state.call;
  if (!currentCall) {
    return;
  }

  if (state.phase === 'ending' || state.localTerminalAction) {
    return;
  }

  clearDisconnectTimeout();

  setCallState({
    phase: 'connecting',
    isResuming: false,
    resumeSource: null,
    recoveryAcknowledged: true,
    error: null,
  });

  updateCurrentCall({
    status: 'connecting',
    disconnected_user_ids: [],
  });
};

const markCallAsActive = () => {
  const state = getCallState();
  const currentCall = state.call;
  if (!currentCall) {
    return;
  }

  if (state.phase === 'ending' || state.localTerminalAction) {
    return;
  }

  clearDisconnectTimeout();

  setCallState({
    phase: 'active',
    isResuming: false,
    resumeSource: null,
    recoveryAcknowledged: true,
    error: null,
    needsRecoveryOffer: false,
  });

  updateCurrentCall({
    status: 'active',
    disconnected_user_ids: [],
  });
};

const transitionToReconnecting = (options: {
  callDoc?: CallDoc;
  markCurrentUserDisconnected?: boolean;
  error?: string | null;
} = {}) => {
  const state = getCallState();
  const sourceCall = options.callDoc || state.call;
  if (
    !sourceCall ||
    !isRecoverableCall(sourceCall) ||
    state.phase === 'ending' ||
    !!state.localTerminalAction
  ) {
    return;
  }

  prepareRecoveryReset();

  const currentUserId = getCurrentUserId();
  const nextDisconnectedUserIds = options.callDoc
    ? options.callDoc.disconnected_user_ids
    : options.markCurrentUserDisconnected && currentUserId
      ? Array.from(new Set([...(sourceCall.disconnected_user_ids || []), currentUserId]))
      : sourceCall.disconnected_user_ids || [];
  const nextRole = state.role || getRoleForCall(sourceCall);

  setCallState({
    phase: 'reconnecting',
    callPresentationMode: 'expanded',
    minimizedCallPosition: null,
    role: nextRole,
    call: {
      ...sourceCall,
      status: 'reconnecting',
      disconnected_user_ids: nextDisconnectedUserIds,
    },
    error: options.error ?? null,
    isResuming: false,
    resumeSource: null,
    recoveryAcknowledged: false,
    needsRecoveryOffer: nextRole === 'caller',
  });
};

const scheduleDisconnectRecovery = (callId: string) => {
  const state = getCallState();
  if (
    state.disconnectTimeoutId !== null ||
    state.phase === 'ending' ||
    !!state.localTerminalAction
  ) {
    return;
  }

  const timeoutId = window.setTimeout(() => {
    const latestState = getCallState();
    clearDisconnectTimeout();

    if (
      latestState.call?.id !== callId ||
      latestState.phase === 'ending' ||
      !!latestState.localTerminalAction
    ) {
      return;
    }

    if (
      isRecoverableCall(latestState.call) ||
      latestState.phase === 'connecting' ||
      latestState.phase === 'active'
    ) {
      transitionToReconnecting({
        error: 'Call connection lost. Trying to reconnect…',
      });
    }
  }, ICE_DISCONNECT_GRACE_MS);

  setCallState({ disconnectTimeoutId: timeoutId });
};

const handleLocalTransportConnected = (callId: string) => {
  const state = getCallState();
  if (
    state.call?.id !== callId ||
    state.phase === 'ending' ||
    !!state.localTerminalAction
  ) {
    return;
  }

  markCallAsActive();

  const latestState = getCallState();
  if (latestState.hasEmittedConnected) {
    return;
  }

  setCallState({ hasEmittedConnected: true });
  emitCallEvent(EVENTS.CALL_CONNECTED, { call_id: callId } satisfies CallActionPayload);
};

const createPeerConnection = (callId: string, iceServers: IceServer[]) => {
  if (typeof RTCPeerConnection === 'undefined') {
    throw new Error('WebRTC is not supported in this browser.');
  }

  const peerConnection = new RTCPeerConnection({
    iceServers: toRtcIceServers(iceServers),
  });
  const remoteStream = new MediaStream();

  peerConnection.ontrack = (event) => {
    const nextRemoteStream = getCallState().remoteStream || remoteStream;
    event.streams.forEach((stream) => {
      stream.getTracks().forEach((track) => {
        if (!nextRemoteStream.getTracks().some((currentTrack) => currentTrack.id === track.id)) {
          nextRemoteStream.addTrack(track);
        }
      });
    });

    if (!event.streams.length && event.track) {
      const track = event.track;
      if (!nextRemoteStream.getTracks().some((currentTrack) => currentTrack.id === track.id)) {
        nextRemoteStream.addTrack(track);
      }
    }

    setCallState({ remoteStream: nextRemoteStream });
  };

  peerConnection.onicecandidate = (event) => {
    if (!event.candidate || !getCallState().call) {
      return;
    }

    emitCallEvent(EVENTS.CALL_ICE_CANDIDATE, {
      call_id: callId,
      candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
    } satisfies CallIceCandidatePayload);
  };

  peerConnection.oniceconnectionstatechange = () => {
    if (getCallState().call?.id !== callId) {
      return;
    }

    switch (peerConnection.iceConnectionState) {
      case 'connected':
      case 'completed':
        handleLocalTransportConnected(callId);
        break;
      case 'disconnected':
        scheduleDisconnectRecovery(callId);
        break;
      case 'failed':
        clearDisconnectTimeout();
        if (getCallState().phase === 'ending' || getCallState().localTerminalAction) {
          return;
        }
        transitionToReconnecting({
          error: 'Call connection failed. Trying to reconnect…',
        });
        break;
      case 'closed':
        clearDisconnectTimeout();
        break;
      default:
        break;
    }
  };

  peerConnection.onconnectionstatechange = () => {
    const state = getCallState();
    if (state.call?.id !== callId) {
      return;
    }

    switch (peerConnection.connectionState) {
      case 'connected':
        handleLocalTransportConnected(callId);
        return;
      case 'disconnected':
        scheduleDisconnectRecovery(callId);
        return;
      case 'failed':
        clearDisconnectTimeout();
        if (state.phase === 'ending' || state.localTerminalAction) {
          return;
        }
        if (isRecoverableCall(state.call) || state.phase === 'connecting' || state.phase === 'active') {
          transitionToReconnecting({
            error: 'Call connection failed. Trying to reconnect…',
          });
          return;
        }
        failAndResetCall('The call connection failed.');
        return;
      case 'closed':
        clearDisconnectTimeout();
        return;
      default:
        return;
    }
  };

  setCallState({
    peerConnection,
    remoteStream,
    hasSentInitialOffer: false,
    hasEmittedConnected: false,
  });

  return peerConnection;
};

const sendAnswerForCurrentCall = async () => {
  const { peerConnection, call } = getCallState();
  if (!peerConnection || !call) {
    return;
  }

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  emitCallEvent(EVENTS.CALL_ANSWER, {
    call_id: call.id,
    sdp: answer,
  } satisfies CallAnswerPayload);
  markCallAsConnecting();
};

const sendInitialOfferForCurrentCall = async () => {
  const state = getCallState();
  if (
    state.role !== 'caller' ||
    !state.call ||
    !state.peerConnection ||
    !state.localStream ||
    state.phase === 'ending' ||
    !!state.localTerminalAction ||
    state.hasSentInitialOffer ||
    state.call.status === 'ringing' ||
    isTerminalStatus(state.call.status)
  ) {
    return false;
  }

  if (state.peerConnection.signalingState !== 'stable' || !!state.peerConnection.localDescription) {
    return false;
  }

  setCallState({
    hasSentInitialOffer: true,
    error: null,
  });

  try {
    const offer = await state.peerConnection.createOffer();
    await state.peerConnection.setLocalDescription(offer);
    emitCallEvent(EVENTS.CALL_OFFER, {
      call_id: state.call.id,
      sdp: offer,
    } satisfies CallOfferPayload);
    markCallAsConnecting();
    return true;
  } catch (error) {
    setCallState({ hasSentInitialOffer: false });
    throw error;
  }
};

const maybeSendRecoveryOffer = async () => {
  const state = getCallState();
  if (
    state.role !== 'caller' ||
    !state.needsRecoveryOffer ||
    !state.call ||
    !state.peerConnection ||
    !state.localStream ||
    state.phase === 'ending' ||
    !!state.localTerminalAction ||
    !isSocketConnected() ||
    isPeerDisconnected(state.call)
  ) {
    return;
  }

  if (state.peerConnection.signalingState !== 'stable' || state.peerConnection.localDescription) {
    return;
  }

  const offer = await state.peerConnection.createOffer();
  await state.peerConnection.setLocalDescription(offer);
  emitCallEvent(EVENTS.CALL_OFFER, {
    call_id: state.call.id,
    sdp: offer,
  } satisfies CallOfferPayload);

  setCallState({
    needsRecoveryOffer: false,
    error: null,
  });
  markCallAsConnecting();
  await applyPendingRecoverySignaling(state.peerConnection);
};

const applyPendingRecoverySignaling = async (
  peerConnection: RTCPeerConnection
) => {
  const state = getCallState();
  if (
    state.phase === 'ending' ||
    !!state.localTerminalAction ||
    !state.call ||
    getCallState().peerConnection !== peerConnection
  ) {
    return false;
  }

  if (state.role === 'callee' && state.pendingRemoteOffer) {
    await applyRemoteDescription(peerConnection, state.pendingRemoteOffer);
    setCallState({ pendingRemoteOffer: null });
    await sendAnswerForCurrentCall();
    return true;
  }

  if (
    state.role === 'caller' &&
    state.pendingRemoteAnswer &&
    peerConnection.localDescription
  ) {
    await applyRemoteDescription(peerConnection, state.pendingRemoteAnswer);
    setCallState({ pendingRemoteAnswer: null });
    markCallAsConnecting();
    return true;
  }

  return false;
};

const prepareRecoveryTransport = async ({
  emitResume,
  forceRecreate,
  preserveRecoveryAcknowledged = false,
}: {
  emitResume: boolean;
  forceRecreate: boolean;
  preserveRecoveryAcknowledged?: boolean;
}) => {
  const state = getCallState();
  if (!state.call) {
    return null;
  }

  let peerConnection = state.peerConnection;

  if (!peerConnection || forceRecreate) {
    prepareRecoveryReset({ preserveRecoveryAcknowledged });
    const latestState = getCallState();
    if (!latestState.call) {
      return null;
    }

    peerConnection = createPeerConnection(
      latestState.call.id,
      latestState.iceServers.length ? latestState.iceServers : state.iceServers
    );
  }

  const latestState = getCallState();
  if (!latestState.call || !peerConnection) {
    return null;
  }

  const localStream = await acquireLocalStream(latestState.call.type, { reuseExisting: true });
  addLocalTracks(peerConnection, localStream);

  if (emitResume) {
    emitCallEvent(EVENTS.CALL_RESUME, {
      call_id: latestState.call.id,
    } satisfies CallActionPayload);
  }

  await applyPendingRecoverySignaling(peerConnection);

  return peerConnection;
};

const safeEndCallRequest = async (callId: string) => {
  try {
    await callsApi.end(callId);
  } catch {
    // Best-effort cleanup only.
  }
};

const safeRejectCallRequest = async (callId: string) => {
  try {
    await callsApi.reject(callId);
  } catch {
    // Best-effort cleanup only.
  }
};

export const startCall = async ({ peerUserId, type, peerUser }: StartCallInput) => {
  const state = getCallState();
  if (state.phase !== 'idle') {
    toast.info('Finish the current call before starting another one.');
    return;
  }

  void primeCallSoundFromUserGesture();

  const mediaPreferences = defaultMediaPreferencesForCall(type);
  setCallState({
    phase: 'outgoing-ringing',
    callPresentationMode: 'expanded',
    minimizedCallPosition: null,
    role: 'caller',
    peerUser: buildPeerUserSummary(peerUserId, peerUser),
    mediaPreferences,
    ...createInitialDeviceState(),
    isMicMuted: mediaPreferences.micMuted,
    isCameraEnabled: mediaPreferences.cameraEnabled,
    isStarting: true,
    error: null,
  });

  let createdSession: CallSession | null = null;

  try {
    createdSession = await callsApi.create({
      callee_user_id: peerUserId,
      type,
    });
    applySessionSnapshot(createdSession);
    setCallState({
      localTerminalAction: null,
    });
    emitCallJoin(createdSession.call.id);

    const peerConnection = createPeerConnection(createdSession.call.id, createdSession.ice_servers);
    const localStream = await acquireLocalStream(createdSession.call.type, { reuseExisting: false });
    addLocalTracks(peerConnection, localStream);
    await sendInitialOfferForCurrentCall();
  } catch (error) {
    if (createdSession?.call?.id) {
      await safeEndCallRequest(createdSession.call.id);
    }

    failAndResetCall(extractApiError(error, 'Unable to start the call.'));
  } finally {
    setCallState({ isStarting: false });
  }
};

export const acceptIncomingCall = async () => {
  const state = getCallState();
  if (state.phase !== 'incoming-ringing' || !state.call) {
    return;
  }

  void primeCallSoundFromUserGesture();

  const socketId = getSocket()?.id;
  if (!socketId) {
    toast.error('Reconnect to the server and try accepting again.');
    return;
  }

  const mediaPreferences = defaultMediaPreferencesForCall(state.call.type);
  setCallState({
    isAccepting: true,
    callPresentationMode: 'expanded',
    minimizedCallPosition: null,
    role: 'callee',
    mediaPreferences,
    ...createInitialDeviceState(),
    isMicMuted: mediaPreferences.micMuted,
    isCameraEnabled: mediaPreferences.cameraEnabled,
    error: null,
  });

  let acceptedSession: CallSession | null = null;

  try {
    acceptedSession = await callsApi.accept(state.call.id, {
      socket_id: socketId,
    } satisfies AcceptCallRequest);

    applySessionSnapshot(acceptedSession);
    setCallState({
      phase: 'connecting',
      localTerminalAction: null,
    });
    emitCallJoin(acceptedSession.call.id);

    const peerConnection = createPeerConnection(
      acceptedSession.call.id,
      acceptedSession.ice_servers.length ? acceptedSession.ice_servers : state.iceServers
    );
    const localStream = await acquireLocalStream(acceptedSession.call.type, { reuseExisting: false });
    addLocalTracks(peerConnection, localStream);

    const pendingOffer = getCallState().pendingRemoteOffer;
    if (pendingOffer) {
      await applyRemoteDescription(peerConnection, pendingOffer);
      setCallState({ pendingRemoteOffer: null });
      await sendAnswerForCurrentCall();
    }
  } catch (error) {
    await safeEndCallRequest(acceptedSession?.call?.id || state.call.id);
    failAndResetCall(extractApiError(error, 'Unable to accept the call.'));
  } finally {
    setCallState({ isAccepting: false });
  }
};

export const rejectIncomingCall = async () => {
  const { call, phase } = getCallState();
  if (!call || phase === 'idle') {
    return;
  }

  await performSocketPrimaryTerminalAction('reject', EVENTS.CALL_REJECT);
};

export const endCurrentCall = async () => {
  const { call, phase } = getCallState();
  if (!call || phase === 'idle') {
    return;
  }

  await performSocketPrimaryTerminalAction('end', EVENTS.CALL_HANGUP);
};

export const setBrowserAudioOutput = async (routeId: string) => {
  const state = getCallState();
  const route = state.availableAudioRoutes.find((candidate) => candidate.id === routeId);
  if (!route) {
    return;
  }

  const previousRouteId = state.selectedAudioRouteId;
  const previousPreferredRouteId = state.preferredAudioRouteId;
  const nextPreferences = syncStoredDevicePreferences({ audioRouteId: routeId });
  setCallState({
    selectedAudioRouteId: routeId,
    preferredAudioRouteId: nextPreferences.audioRouteId,
  });

  try {
    await applyBrowserAudioOutputToElement(routeId, { showToast: true });
  } catch {
    const restoredPreferences = syncStoredDevicePreferences({
      audioRouteId: previousPreferredRouteId,
    });
    setCallState({
      selectedAudioRouteId: previousRouteId,
      preferredAudioRouteId: restoredPreferences.audioRouteId,
    });
    return;
  }

  await refreshCallDevices();
};

export const toggleMicrophone = () => {
  const { localStream, mediaPreferences } = getCallState();
  if (!localStream) {
    return;
  }

  const nextPreferences = {
    ...mediaPreferences,
    micMuted: !mediaPreferences.micMuted,
  };
  applyMediaPreferencesToStream(localStream, getCallState().call?.type || 'audio', nextPreferences);
  syncMediaPreferenceState(getCallState().call?.type || 'audio', nextPreferences);
  emitCurrentParticipantMediaState({
    audio_enabled: !nextPreferences.micMuted,
  });
};

export const switchMicrophone = async (deviceId: string) => {
  const state = getCallState();
  if (!state.localStream) {
    return;
  }

  await replaceLocalTrack('audio', deviceId);
};

export const toggleCamera = () => {
  const { localStream, call, mediaPreferences } = getCallState();
  if (!localStream || call?.type !== 'video') {
    return;
  }

  const nextPreferences = {
    ...mediaPreferences,
    cameraEnabled: !mediaPreferences.cameraEnabled,
  };
  applyMediaPreferencesToStream(localStream, call.type, nextPreferences);
  syncMediaPreferenceState(call.type, nextPreferences);
  emitCurrentParticipantMediaState({
    video_enabled: nextPreferences.cameraEnabled,
  });
};

export const switchCamera = async (deviceId: string) => {
  const state = getCallState();
  if (!state.localStream || state.call?.type !== 'video') {
    return;
  }

  await replaceLocalTrack('video', deviceId);
};

export const hydrateRecoverableCall = (session: CallSession) => {
  const state = getCallState();
  const sameCall = state.call?.id === session.call.id;

  if (!sameCall && state.call) {
    clearPeerConnectionState(false);
  }

  const role = getRoleForCall(session.call);
  const mediaPreferences = getMediaPreferencesFromCall(
    session.call,
    sameCall ? state.mediaPreferences : defaultMediaPreferencesForCall(session.call.type)
  );
  const nextDeviceState = sameCall
    ? {
        availableMicrophones: state.availableMicrophones,
        availableCameras: state.availableCameras,
        availableAudioRoutes: state.availableAudioRoutes,
        selectedMicrophoneId: state.selectedMicrophoneId,
        selectedCameraId: state.selectedCameraId,
        selectedAudioRouteId: state.selectedAudioRouteId,
        preferredMicrophoneId: state.preferredMicrophoneId,
        preferredCameraId: state.preferredCameraId,
        preferredAudioRouteId: state.preferredAudioRouteId,
        browserAudioOutputSupported: state.browserAudioOutputSupported,
      }
    : createInitialDeviceState();

  setCallState({
    phase: isRecoverableCall(session.call)
      ? 'reconnecting'
      : role === 'caller'
        ? 'outgoing-ringing'
        : 'incoming-ringing',
    callPresentationMode: 'expanded',
    minimizedCallPosition: null,
    role,
    call: session.call,
    peerUser: session.peer_user,
    iceServers: session.ice_servers,
    mediaPreferences,
    ...nextDeviceState,
    isMicMuted: mediaPreferences.micMuted,
    isCameraEnabled: session.call.type === 'video' ? mediaPreferences.cameraEnabled : false,
    isResuming: sameCall ? state.isResuming : false,
    resumeSource: sameCall ? state.resumeSource : null,
    recoveryAcknowledged: sameCall ? state.recoveryAcknowledged : false,
    needsRecoveryOffer: role === 'caller' && isRecoverableCall(session.call),
    localTerminalAction: null,
    pendingTerminalActionId: null,
    error: sameCall ? state.error : null,
  });
  syncCurrentParticipantMediaState(session.call);
};

/**
 * Low-level resume operation. Assumes the call is in a recoverable state and
 * the socket is connected. Transitions the phase to 'reconnecting', recreates
 * the peer connection, and emits `call.resume` to the server.
 *
 * Behavioral differences by source:
 * - `'manual'`: Shows a toast if the socket is not connected (user needs feedback).
 * - All other sources: Fails silently if socket is unavailable.
 *
 * Returns `true` if recovery was initiated, `false` if it was skipped.
 */
export const resumeRecoveredCall = async (source: RecoverySource) => {
  const state = getCallState();
  if (!state.call || state.phase === 'ending' || !!state.localTerminalAction) {
    return false;
  }

  if (!isSocketConnected()) {
    if (source === 'manual') {
      toast.error('Reconnect to the server before retrying the call.');
    }
    return false;
  }

  setCallState({
    phase: 'reconnecting',
    callPresentationMode: 'expanded',
    minimizedCallPosition: null,
    isResuming: true,
    resumeSource: source,
    recoveryAcknowledged: false,
    error: null,
    needsRecoveryOffer: state.role === 'caller',
  });

  await prepareRecoveryTransport({
    emitResume: true,
    forceRecreate: true,
  });

  return true;
};

export const continueAcknowledgedRecovery = async (source: RecoverySource) => {
  const state = getCallState();
  if (
    !state.call ||
    state.phase !== 'reconnecting' ||
    !state.recoveryAcknowledged ||
    state.isResuming ||
    !!state.localTerminalAction
  ) {
    return false;
  }

  if (!isSocketConnected()) {
    if (source === 'manual') {
      toast.error('Reconnect to the server before retrying the call.');
    }
    return false;
  }

  setCallState({
    callPresentationMode: 'expanded',
    minimizedCallPosition: null,
    error: null,
    needsRecoveryOffer: state.role === 'caller',
  });

  try {
    const peerConnection = await prepareRecoveryTransport({
      emitResume: false,
      forceRecreate: true,
      preserveRecoveryAcknowledged: true,
    });

    if (peerConnection) {
      await applyPendingRecoverySignaling(peerConnection);
    }

    await maybeSendRecoveryOffer();

    if (peerConnection) {
      await applyPendingRecoverySignaling(peerConnection);
    }

    return true;
  } catch (error) {
    setRecoveryError(
      extractApiError(error, 'Unable to continue recovering the call.'),
      source === 'manual'
    );
    return false;
  }
};

/**
 * Entry point for all call recovery attempts. Validates recoverability (phase,
 * deadline, local terminal actions) before delegating to `resumeRecoveredCall`.
 *
 * Called from four sources — each has slightly different semantics:
 * - `'page-load'`:        On app mount if `callsApi.getActive()` finds a live call.
 * - `'socket-connect'`:   When the socket reconnects while a call is in state.
 * - `'manual'`:           User taps the "Retry" button in the UI. Shows toasts on failure.
 * - `'recovery-available'`: Server sends `call.recovery_available` — the deadline was extended.
 *
 * The `source` is forwarded to `resumeRecoveredCall` which uses it to decide
 * whether to surface errors to the user.
 */
export const attemptCallRecovery = async (source: RecoverySource) => {
  const state = getCallState();
  if (
    !state.call ||
    !isRecoverableCall(state.call) ||
    state.isResuming ||
    state.recoveryAcknowledged ||
    state.phase === 'ending' ||
    !!state.localTerminalAction
  ) {
    return false;
  }

  try {
    return await resumeRecoveredCall(source);
  } catch (error) {
    setRecoveryError(extractApiError(error, 'Unable to recover the call.'), source === 'manual');
    return false;
  }
};

export const handleIncomingSession = async (session: CallSession) => {
  const state = getCallState();
  if (state.phase !== 'idle' && state.call?.id !== session.call.id) {
    rejectCallWithSocketFallback(session.call.id);
    toast.info('Missed an incoming call because another call is already in progress.');
    return;
  }

  const mediaPreferences = defaultMediaPreferencesForCall(session.call.type);
  setCallState({
    phase: 'incoming-ringing',
    callPresentationMode: 'expanded',
    minimizedCallPosition: null,
    role: 'callee',
    call: session.call,
    peerUser: session.peer_user,
    iceServers: session.ice_servers,
    mediaPreferences,
    ...createInitialDeviceState(),
    isMicMuted: mediaPreferences.micMuted,
    isCameraEnabled: mediaPreferences.cameraEnabled,
    recoveryAcknowledged: false,
    error: null,
  });
  syncCurrentParticipantMediaState(session.call, { applyToLocalStream: false });
};

export const handleAcceptedSession = async (session: CallSession) => {
  const state = getCallState();
  if (state.phase === 'ending' || !!state.localTerminalAction) {
    return;
  }

  const { call } = state;
  if (call && call.id !== session.call.id) {
    return;
  }

  const role = getRoleForCall(session.call);
  const nextPhase =
    state.phase === 'reconnecting'
      ? 'reconnecting'
      : role === 'caller'
        ? state.hasSentInitialOffer || state.phase === 'connecting' || state.phase === 'active'
          ? state.phase
          : 'outgoing-ringing'
        : state.phase === 'active'
          ? 'active'
          : 'connecting';

  applySessionSnapshot(session);
  setCallState({
    phase: nextPhase,
    role,
    error: null,
  });

  if (role === 'caller') {
    await sendInitialOfferForCurrentCall();
  }
};

export const handleParticipantUpdated = (event: CallParticipantUpdatedEvent) => {
  const state = getCallState();
  if (
    state.call?.id !== event.call.id ||
    state.phase === 'idle' ||
    state.phase === 'ending' ||
    !!state.localTerminalAction
  ) {
    return;
  }

  applySessionSnapshot(event);
};

export const handleOfferSignal = async (payload: CallOfferPayload) => {
  const state = getCallState();
  if (
    state.call?.id !== payload.call_id ||
    state.role !== 'callee' ||
    state.phase === 'ending' ||
    !!state.localTerminalAction
  ) {
    return;
  }

  try {
    const { peerConnection, phase, isAccepting } = state;
    if (!peerConnection || phase === 'incoming-ringing' || isAccepting) {
      setCallState({ pendingRemoteOffer: payload.sdp });
      return;
    }

    await applyRemoteDescription(peerConnection, payload.sdp);
    setCallState({ pendingRemoteOffer: null });
    await sendAnswerForCurrentCall();
  } catch (error) {
    if (getCallState().phase === 'reconnecting') {
      setRecoveryError(extractApiError(error, 'Unable to apply the recovered offer.'));
      return;
    }

    throw error;
  }
};

export const handleAnswerSignal = async (payload: CallAnswerPayload) => {
  const state = getCallState();
  if (
    state.call?.id !== payload.call_id ||
    state.role !== 'caller' ||
    state.phase === 'ending' ||
    !!state.localTerminalAction
  ) {
    return;
  }

  try {
    const { peerConnection } = state;
    if (!peerConnection) {
      setCallState({ pendingRemoteAnswer: payload.sdp });
      return;
    }

    await applyRemoteDescription(peerConnection, payload.sdp);
    setCallState({ pendingRemoteAnswer: null });
    markCallAsConnecting();
  } catch (error) {
    if (getCallState().phase === 'reconnecting') {
      setRecoveryError(extractApiError(error, 'Unable to apply the recovered answer.'));
      return;
    }

    throw error;
  }
};

export const handleIceCandidateSignal = async (payload: CallIceCandidatePayload) => {
  const { call, peerConnection, pendingIceCandidates } = getCallState();
  if (call?.id !== payload.call_id) {
    return;
  }

  if (!peerConnection?.remoteDescription) {
    setCallState({
      pendingIceCandidates: [...pendingIceCandidates, payload.candidate],
    });
    return;
  }

  await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
};

export const handleConnectedSignal = (payload: CallActionPayload) => {
  const state = getCallState();
  if (
    state.call?.id !== payload.call_id ||
    state.phase === 'ending' ||
    !!state.localTerminalAction
  ) {
    return;
  }

  setCallState({ hasEmittedConnected: true });
  markCallAsActive();
};

export const handleSocketDisconnected = () => {
  const state = getCallState();
  if (!state.call) {
    return;
  }

  if (state.phase === 'ending' || !!state.localTerminalAction) {
    return;
  }

  if (isRecoverableCall(state.call) || state.phase === 'connecting' || state.phase === 'active') {
    transitionToReconnecting({ markCurrentUserDisconnected: true });
    return;
  }

  toast.error('The call was closed because the realtime connection dropped.');
  resetCallState();
};

export const handleReconnectingCall = (callDoc: CallDoc) => {
  const state = getCallState();
  if (
    state.call?.id !== callDoc.id ||
    state.phase === 'ending' ||
    !!state.localTerminalAction
  ) {
    return;
  }

  transitionToReconnecting({ callDoc });
};

export const handleRecoverySocketError = (payload: SocketErrorPayload) => {
  const state = getCallState();
  if (
    !state.call ||
    state.phase !== 'reconnecting' ||
    !!state.localTerminalAction ||
    !RECOVERABLE_RESUME_ERROR_CODES.has(payload.code) ||
    (!state.isResuming && state.resumeSource === null)
  ) {
    return false;
  }

  setCallState({
    isResuming: false,
    resumeSource: null,
    recoveryAcknowledged: false,
    error: null,
  });

  return true;
};

export const handleResumedSession = async (session: CallSession) => {
  const state = getCallState();
  if (
    (state.call && state.call.id !== session.call.id) ||
    state.phase === 'ending' ||
    !!state.localTerminalAction
  ) {
    return;
  }

  hydrateRecoverableCall(session);
  setCallState({
    isResuming: false,
    resumeSource: null,
    recoveryAcknowledged: true,
    error: null,
  });

  try {
    const peerConnection = await prepareRecoveryTransport({
      emitResume: false,
      forceRecreate: false,
    });

    if (peerConnection) {
      await applyPendingRecoverySignaling(peerConnection);
    }

    setCallState({
      isResuming: false,
      resumeSource: null,
      recoveryAcknowledged: true,
      error: null,
    });

    await maybeSendRecoveryOffer();

    if (peerConnection) {
      await applyPendingRecoverySignaling(peerConnection);
    }
  } catch (error) {
    setRecoveryError(extractApiError(error, 'Unable to resume the recovered call.'));
  }
};

const getTerminalCallMessage = (callDoc: CallDoc, peerUser: CallPeerUserSummary | null) => {
  const peerName = peerUser?.display_name || peerUser?.username || peerUser?.id || 'The other user';
  switch (callDoc.status) {
    case 'rejected':
      return `${peerName} rejected the call.`;
    case 'cancelled':
      return 'The call was cancelled.';
    case 'expired':
      return 'The call expired before it was answered.';
    case 'ended':
      return 'The call ended.';
    default:
      return null;
  }
};

export const handleTerminalCall = (payload: CallTerminalPayload) => {
  const { call: callDoc, peerUser: payloadPeerUser } = normalizeTerminalPayload(payload);
  clearBackgroundRejectFallback(callDoc.id);

  const { call, peerUser, phase } = getCallState();
  if (call?.id !== callDoc.id) {
    return;
  }

  clearTerminalFallbackTimeout();

  if (phase !== 'ending' && isTerminalStatus(callDoc.status)) {
    showTerminalCallScreen(callDoc, payloadPeerUser);
    return;
  }

  finalizeTerminalCall(callDoc, {
    suppressToast: phase === 'ending',
    fallbackMessage:
      phase !== 'ending'
        ? getTerminalCallMessage(callDoc, payloadPeerUser ?? peerUser)
        : null,
  });
};

/**
 * Called when the server-side reconnect deadline passes without a successful
 * recovery. Triggered either by a local deadline check in `attemptCallRecovery`
 * or by the `call.recovery_available` event expiring on the server.
 *
 * Resets state to idle and shows a toast. No-ops if already idle (e.g., the
 * call was ended by the other party before the deadline check fired).
 */
export const handleRecoveryExpired = (
  message = 'The reconnect window ended and the call could not be recovered.'
) => {
  if (getCallState().phase === 'idle') {
    return;
  }

  toast.info(message);
  resetCallState();
};

export const resetCallController = () => {
  resetCallState();
};

export const minimizeCallView = () => {
  const state = getCallState();
  if (!state.call || !isMinimizableCallPhase(state.phase)) {
    return;
  }

  setCallState({ callPresentationMode: 'minimized' });
};

export const expandCallView = () => {
  if (getCallState().phase === 'idle') {
    return;
  }

  setCallState({ callPresentationMode: 'expanded' });
};

export const setMinimizedCallPosition = (position: MinimizedCallPosition) => {
  const state = getCallState();
  if (!state.call || state.callPresentationMode !== 'minimized') {
    return;
  }

  setCallState({ minimizedCallPosition: position });
};

export const setExpandedSelfPreviewPlacement = (
  placement: CallExpandedSelfPreviewPlacement
) => {
  rememberExpandedSelfPreviewPlacement(placement);
  setCallState({ expandedSelfPreviewPlacement: placement });
};

export const resetCallPresentation = () => {
  setCallState({
    callPresentationMode: 'expanded',
    minimizedCallPosition: null,
  });
};
