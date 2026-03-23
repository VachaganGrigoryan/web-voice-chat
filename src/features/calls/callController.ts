import { create } from 'zustand';
import { toast } from 'sonner';
import { callsApi } from '@/api/endpoints';
import {
  AcceptCallRequest,
  CallActionPayload,
  CallAnswerPayload,
  CallDoc,
  CallIceCandidatePayload,
  CallOfferPayload,
  CallPeerUserSummary,
  CallSession,
  CallType,
  IceServer,
} from '@/api/types';
import { useAuthStore } from '@/store/authStore';
import { EVENTS } from '@/socket/events';
import { useSocketStore } from '@/socket/socket';

export type CallPhase =
  | 'idle'
  | 'outgoing-ringing'
  | 'incoming-ringing'
  | 'connecting'
  | 'active'
  | 'reconnecting'
  | 'ending'
  | 'failed';

export type CallRole = 'caller' | 'callee' | null;
export type RecoverySource =
  | 'page-load'
  | 'socket-connect'
  | 'manual'
  | 'recovery-available';
type LocalTerminalAction = 'reject' | 'end' | null;

interface StartCallInput {
  peerUserId: string;
  type: CallType;
  peerUser?: Partial<CallPeerUserSummary> | null;
}

interface MediaPreferences {
  micMuted: boolean;
  cameraEnabled: boolean;
}

interface CallControllerState {
  phase: CallPhase;
  role: CallRole;
  call: CallDoc | null;
  peerUser: CallPeerUserSummary | null;
  iceServers: IceServer[];
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
  pendingRemoteOffer: RTCSessionDescriptionInit | null;
  pendingRemoteAnswer: RTCSessionDescriptionInit | null;
  pendingIceCandidates: RTCIceCandidateInit[];
  mediaPreferences: MediaPreferences;
  isMicMuted: boolean;
  isCameraEnabled: boolean;
  isStarting: boolean;
  isAccepting: boolean;
  isEnding: boolean;
  isResuming: boolean;
  resumeSource: RecoverySource | null;
  needsRecoveryOffer: boolean;
  hasSentInitialOffer: boolean;
  hasEmittedConnected: boolean;
  localTerminalAction: LocalTerminalAction;
  disconnectTimeoutId: number | null;
  endingFallbackTimeoutId: number | null;
  error: string | null;
}

const initialMediaPreferences: MediaPreferences = {
  micMuted: false,
  cameraEnabled: false,
};

const initialCallState: CallControllerState = {
  phase: 'idle',
  role: null,
  call: null,
  peerUser: null,
  iceServers: [],
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  pendingRemoteOffer: null,
  pendingRemoteAnswer: null,
  pendingIceCandidates: [],
  mediaPreferences: initialMediaPreferences,
  isMicMuted: false,
  isCameraEnabled: false,
  isStarting: false,
  isAccepting: false,
  isEnding: false,
  isResuming: false,
  resumeSource: null,
  needsRecoveryOffer: false,
  hasSentInitialOffer: false,
  hasEmittedConnected: false,
  localTerminalAction: null,
  disconnectTimeoutId: null,
  endingFallbackTimeoutId: null,
  error: null,
};

const ICE_DISCONNECT_GRACE_MS = 3_000;
const ENDING_FALLBACK_TIMEOUT_MS = 4_000;

export const useCallStore = create<CallControllerState>(() => initialCallState);

const getCallState = () => useCallStore.getState();
const setCallState = (patch: Partial<CallControllerState>) => useCallStore.setState(patch);
const getSocket = () => useSocketStore.getState().socket;
const isSocketConnected = () => !!getSocket()?.connected;
const getCurrentUserId = () => useAuthStore.getState().userId;

const getErrorMessage = (error: any, fallback: string) => {
  const errorData = error?.response?.data?.error;
  if (typeof errorData === 'string') return errorData;
  if (errorData?.message) return errorData.message;
  if (typeof error?.message === 'string' && error.message.trim()) return error.message;
  return fallback;
};

const isRecoverableStatus = (status: CallDoc['status']) =>
  status === 'accepted' ||
  status === 'connecting' ||
  status === 'active' ||
  status === 'reconnecting';

const isRecoverableCall = (call: CallDoc | null | undefined) =>
  !!call && isRecoverableStatus(call.status);

const isTerminalStatus = (status: CallDoc['status']) =>
  status === 'rejected' ||
  status === 'cancelled' ||
  status === 'expired' ||
  status === 'ended';

const isRecoveryExpired = (call: CallDoc | null | undefined) => {
  if (!call?.reconnect_deadline_at) {
    return false;
  }

  return new Date(call.reconnect_deadline_at).getTime() <= Date.now();
};

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
  avatar: (peerUser?.avatar as Record<string, any> | null | undefined) ?? null,
  is_online: peerUser?.is_online ?? false,
});

const emitCallEvent = (event: string, payload: unknown) => {
  getSocket()?.emit(event, payload);
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

const clearEndingFallbackTimeout = () => {
  const timeoutId = getCallState().endingFallbackTimeoutId;
  if (timeoutId !== null) {
    window.clearTimeout(timeoutId);
    setCallState({ endingFallbackTimeoutId: null });
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

const clearPeerConnectionState = (preserveLocalStream: boolean) => {
  const state = getCallState();
  disposePeerConnection(state.peerConnection);
  stopStreamTracks(state.remoteStream);

  if (!preserveLocalStream) {
    stopStreamTracks(state.localStream);
  }

  setCallState({
    peerConnection: null,
    remoteStream: null,
    pendingRemoteOffer: null,
    pendingRemoteAnswer: null,
    pendingIceCandidates: [],
    hasSentInitialOffer: false,
    hasEmittedConnected: false,
    ...(preserveLocalStream ? {} : { localStream: null }),
  });
};

const resetCallState = () => {
  clearDisconnectTimeout();
  clearEndingFallbackTimeout();
  clearPeerConnectionState(false);
  useCallStore.setState(initialCallState);
};

const prepareRecoveryReset = () => {
  clearDisconnectTimeout();
  clearEndingFallbackTimeout();
  clearPeerConnectionState(true);
  const state = getCallState();
  if (!state.call) {
    return;
  }

  setCallState({
    phase: 'reconnecting',
    call: {
      ...state.call,
      status: 'reconnecting',
    },
    isStarting: false,
    isAccepting: false,
    isEnding: false,
    localTerminalAction: null,
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

const beginEndingCall = (action: Exclude<LocalTerminalAction, null>) => {
  const state = getCallState();
  if (!state.call || state.phase === 'idle' || state.phase === 'ending' || !!state.localTerminalAction) {
    return null;
  }

  clearDisconnectTimeout();
  clearEndingFallbackTimeout();

  const callId = state.call.id;
  const timeoutId = window.setTimeout(() => {
    const latestState = getCallState();
    if (latestState.call?.id !== callId || latestState.phase !== 'ending') {
      return;
    }

    finalizeTerminalCall(null, {
      fallbackMessage: action === 'reject' ? 'The call was rejected.' : 'The call ended.',
    });
  }, ENDING_FALLBACK_TIMEOUT_MS);

  setCallState({
    phase: 'ending',
    isEnding: true,
    isStarting: false,
    isAccepting: false,
    isResuming: false,
    resumeSource: null,
    localTerminalAction: action,
    endingFallbackTimeoutId: timeoutId,
    error: null,
  });

  return state.call;
};

const toRtcIceServers = (iceServers: IceServer[]): RTCIceServer[] =>
  iceServers.map((server) => ({
    urls: server.urls,
    username: server.username || undefined,
    credential: server.credential || undefined,
  }));

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

const acquireLocalStream = async (
  callType: CallType,
  options: { reuseExisting: boolean } = { reuseExisting: true }
) => {
  const state = getCallState();
  const preferences = state.mediaPreferences;

  if (options.reuseExisting && hasReusableLocalStream(state.localStream, callType)) {
    applyMediaPreferencesToStream(state.localStream!, callType, preferences);
    syncMediaPreferenceState(callType, preferences);
    return state.localStream!;
  }

  if (state.localStream) {
    stopStreamTracks(state.localStream);
    setCallState({ localStream: null });
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Media devices are not available in this browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia(
    callType === 'video'
      ? { audio: true, video: { facingMode: 'user' } }
      : { audio: true, video: false }
  );

  applyMediaPreferencesToStream(stream, callType, preferences);
  setCallState({ localStream: stream });
  syncMediaPreferenceState(callType, preferences);

  return stream;
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
    role: nextRole,
    call: {
      ...sourceCall,
      status: 'reconnecting',
      disconnected_user_ids: nextDisconnectedUserIds,
    },
    error: options.error ?? null,
    isResuming: false,
    resumeSource: null,
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
};

const prepareRecoveryTransport = async ({
  emitResume,
  forceRecreate,
}: {
  emitResume: boolean;
  forceRecreate: boolean;
}) => {
  const state = getCallState();
  if (!state.call) {
    return null;
  }

  let peerConnection = state.peerConnection;

  if (!peerConnection || forceRecreate) {
    prepareRecoveryReset();
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

  const mediaPreferences = defaultMediaPreferencesForCall(type);
  setCallState({
    phase: 'outgoing-ringing',
    role: 'caller',
    peerUser: buildPeerUserSummary(peerUserId, peerUser),
    mediaPreferences,
    isMicMuted: mediaPreferences.micMuted,
    isCameraEnabled: mediaPreferences.cameraEnabled,
    isStarting: true,
    error: null,
  });

  let createdSession: CallSession | null = null;

  try {
    const response = await callsApi.create({
      callee_user_id: peerUserId,
      type,
    });

    createdSession = response.data.data;
    setCallState({
      call: createdSession.call,
      peerUser: createdSession.peer_user,
      iceServers: createdSession.ice_servers,
      localTerminalAction: null,
    });

    const peerConnection = createPeerConnection(createdSession.call.id, createdSession.ice_servers);
    const localStream = await acquireLocalStream(createdSession.call.type, { reuseExisting: false });
    addLocalTracks(peerConnection, localStream);
    await sendInitialOfferForCurrentCall();
  } catch (error) {
    if (createdSession?.call?.id) {
      await safeEndCallRequest(createdSession.call.id);
    }

    failAndResetCall(getErrorMessage(error, 'Unable to start the call.'));
  } finally {
    setCallState({ isStarting: false });
  }
};

export const acceptIncomingCall = async () => {
  const state = getCallState();
  if (state.phase !== 'incoming-ringing' || !state.call) {
    return;
  }

  const socketId = getSocket()?.id;
  if (!socketId) {
    toast.error('Reconnect to the server and try accepting again.');
    return;
  }

  const mediaPreferences = defaultMediaPreferencesForCall(state.call.type);
  setCallState({
    isAccepting: true,
    role: 'callee',
    mediaPreferences,
    isMicMuted: mediaPreferences.micMuted,
    isCameraEnabled: mediaPreferences.cameraEnabled,
    error: null,
  });

  let acceptedSession: CallSession | null = null;

  try {
    const response = await callsApi.accept(state.call.id, {
      socket_id: socketId,
    } satisfies AcceptCallRequest);
    acceptedSession = response.data.data;

    setCallState({
      call: acceptedSession.call,
      peerUser: acceptedSession.peer_user,
      iceServers: acceptedSession.ice_servers,
      phase: 'connecting',
      localTerminalAction: null,
    });

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
    failAndResetCall(getErrorMessage(error, 'Unable to accept the call.'));
  } finally {
    setCallState({ isAccepting: false });
  }
};

export const rejectIncomingCall = async () => {
  const { call, phase } = getCallState();
  if (!call || phase === 'idle') {
    return;
  }

  const currentCall = beginEndingCall('reject');
  if (!currentCall) {
    return;
  }

  emitCallEvent(EVENTS.CALL_REJECT, { call_id: call.id } satisfies CallActionPayload);

  try {
    const callDoc = await callsApi.reject(currentCall.id);
    finalizeTerminalCall(callDoc, { suppressToast: true });
  } catch (error) {
    toast.error(getErrorMessage(error, 'Unable to reject the call.'));
  }
};

export const endCurrentCall = async () => {
  const { call, phase } = getCallState();
  if (!call || phase === 'idle') {
    return;
  }

  const currentCall = beginEndingCall('end');
  if (!currentCall) {
    return;
  }

  emitCallEvent(EVENTS.CALL_HANGUP, { call_id: call.id } satisfies CallActionPayload);

  try {
    const callDoc = await callsApi.end(currentCall.id);
    finalizeTerminalCall(callDoc, { suppressToast: true });
  } catch (error) {
    toast.error(getErrorMessage(error, 'Unable to end the call.'));
  }
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
};

export const hydrateRecoverableCall = (session: CallSession) => {
  const state = getCallState();
  const sameCall = state.call?.id === session.call.id;

  if (!sameCall && state.call) {
    clearPeerConnectionState(false);
  }

  const role = getRoleForCall(session.call);
  const mediaPreferences = sameCall
    ? state.mediaPreferences
    : defaultMediaPreferencesForCall(session.call.type);

  setCallState({
    phase: isRecoverableCall(session.call)
      ? 'reconnecting'
      : role === 'caller'
        ? 'outgoing-ringing'
        : 'incoming-ringing',
    role,
    call: session.call,
    peerUser: session.peer_user,
    iceServers: session.ice_servers,
    mediaPreferences,
    isMicMuted: mediaPreferences.micMuted,
    isCameraEnabled: session.call.type === 'video' ? mediaPreferences.cameraEnabled : false,
    isResuming: sameCall ? state.isResuming : false,
    resumeSource: sameCall ? state.resumeSource : null,
    needsRecoveryOffer: role === 'caller' && isRecoverableCall(session.call),
    localTerminalAction: sameCall && !isTerminalStatus(session.call.status) ? state.localTerminalAction : null,
    error: sameCall ? state.error : null,
  });
};

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

  if (isRecoveryExpired(state.call)) {
    return false;
  }

  setCallState({
    phase: 'reconnecting',
    isResuming: true,
    resumeSource: source,
    error: null,
    needsRecoveryOffer: state.role === 'caller',
  });

  await prepareRecoveryTransport({
    emitResume: true,
    forceRecreate: true,
  });

  return true;
};

export const attemptCallRecovery = async (source: RecoverySource) => {
  const state = getCallState();
  if (
    !state.call ||
    !isRecoverableCall(state.call) ||
    state.isResuming ||
    state.phase === 'ending' ||
    !!state.localTerminalAction
  ) {
    return false;
  }

  if (isRecoveryExpired(state.call)) {
    handleRecoveryExpired();
    return false;
  }

  try {
    return await resumeRecoveredCall(source);
  } catch (error) {
    setRecoveryError(getErrorMessage(error, 'Unable to recover the call.'), source === 'manual');
    return false;
  }
};

export const handleIncomingSession = async (session: CallSession) => {
  const state = getCallState();
  if (state.phase !== 'idle' && state.call?.id !== session.call.id) {
    emitCallEvent(EVENTS.CALL_REJECT, { call_id: session.call.id } satisfies CallActionPayload);
    await safeRejectCallRequest(session.call.id);
    toast.info('Missed an incoming call because another call is already in progress.');
    return;
  }

  const mediaPreferences = defaultMediaPreferencesForCall(session.call.type);
  setCallState({
    phase: 'incoming-ringing',
    role: 'callee',
    call: session.call,
    peerUser: session.peer_user,
    iceServers: session.ice_servers,
    mediaPreferences,
    isMicMuted: mediaPreferences.micMuted,
    isCameraEnabled: mediaPreferences.cameraEnabled,
    error: null,
  });
};

export const handleAcceptedSession = async (session: CallSession) => {
  const state = getCallState();
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

  setCallState({
    phase: nextPhase,
    call: session.call,
    peerUser: session.peer_user,
    iceServers: session.ice_servers,
    role,
    error: null,
  });

  if (role === 'caller') {
    await sendInitialOfferForCurrentCall();
  }
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
      setRecoveryError(getErrorMessage(error, 'Unable to apply the recovered offer.'));
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
      setRecoveryError(getErrorMessage(error, 'Unable to apply the recovered answer.'));
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

  try {
    await prepareRecoveryTransport({
      emitResume: false,
      forceRecreate: false,
    });

    setCallState({
      isResuming: false,
      resumeSource: null,
      error: null,
    });

    await maybeSendRecoveryOffer();
  } catch (error) {
    setRecoveryError(getErrorMessage(error, 'Unable to resume the recovered call.'));
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

export const handleTerminalCall = (callDoc: CallDoc) => {
  const { call, peerUser, phase } = getCallState();
  if (call?.id !== callDoc.id) {
    return;
  }

  finalizeTerminalCall(callDoc, {
    suppressToast: phase === 'ending',
    fallbackMessage: phase !== 'ending' ? getTerminalCallMessage(callDoc, peerUser) : null,
  });
};

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
