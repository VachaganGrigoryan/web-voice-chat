import { Capacitor } from '@capacitor/core';
import type { CallType } from '@/api/types';
import * as rootCallController from '@/features/calls/callController';
import {
  getCallState,
  setCallState,
  useCallStore,
  type CallAudioRoute,
} from '@/features/calls/callStore';
import {
  readCallDevicePreferences,
  writeCallDevicePreferences,
} from '@/features/calls/callDevicePreferences';
import {
  androidAudioRoute,
  type AndroidAudioRouteId,
  type AndroidAudioRouteOption,
} from '../plugins/androidAudioRoute';

const isNativeAndroid =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const ACTIVE_NATIVE_AUDIO_PHASES = new Set([
  'outgoing-ringing',
  'connecting',
  'active',
  'reconnecting',
]);

const toCallAudioRoute = (route: AndroidAudioRouteOption): CallAudioRoute => ({
  id: route.id,
  label: route.label,
  kind: 'browser-output',
  source: 'browser',
});

const clearNativeAudioState = () => {
  setCallState({
    availableAudioRoutes: [],
    selectedAudioRouteId: null,
    browserAudioOutputSupported: true,
  });
};

const choosePreferredRouteId = ({
  callType,
  availableRouteIds,
  currentRouteId,
  selectedRouteId,
  preferredRouteId,
}: {
  callType: CallType;
  availableRouteIds: AndroidAudioRouteId[];
  currentRouteId: AndroidAudioRouteId | null;
  selectedRouteId: string | null;
  preferredRouteId: string | null;
}) => {
  if (preferredRouteId && availableRouteIds.includes(preferredRouteId as AndroidAudioRouteId)) {
    return preferredRouteId as AndroidAudioRouteId;
  }

  if (selectedRouteId && availableRouteIds.includes(selectedRouteId as AndroidAudioRouteId)) {
    return selectedRouteId as AndroidAudioRouteId;
  }

  if (currentRouteId && availableRouteIds.includes(currentRouteId)) {
    return currentRouteId;
  }

  if (callType === 'video' && availableRouteIds.includes('speaker')) {
    return 'speaker';
  }

  if (availableRouteIds.includes('earpiece')) {
    return 'earpiece';
  }

  if (availableRouteIds.includes('speaker')) {
    return 'speaker';
  }

  return availableRouteIds[0] || null;
};

const syncNativeRoutes = async (callType: CallType = getCallState().call?.type || 'audio') => {
  if (!isNativeAndroid) {
    return;
  }

  const routes = (await androidAudioRoute.listRoutes()).filter((route) => route.available);
  if (!routes.length) {
    clearNativeAudioState();
    return;
  }

  const state = getCallState();
  const currentRoute = await androidAudioRoute.getCurrentRoute();
  const preferredRouteId = choosePreferredRouteId({
    callType,
    availableRouteIds: routes.map((route) => route.id),
    currentRouteId: currentRoute.id,
    selectedRouteId: state.selectedAudioRouteId,
    preferredRouteId: state.preferredAudioRouteId || readCallDevicePreferences().audioRouteId,
  });

  if (preferredRouteId && preferredRouteId !== currentRoute.id) {
    await androidAudioRoute.setRoute({ id: preferredRouteId });
  }

  const resolvedRoute = preferredRouteId && preferredRouteId !== currentRoute.id
    ? await androidAudioRoute.getCurrentRoute()
    : currentRoute;
  const nextPreferences = writeCallDevicePreferences({
    audioRouteId: resolvedRoute.id,
  });

  setCallState({
    availableAudioRoutes: routes.map(toCallAudioRoute),
    selectedAudioRouteId: resolvedRoute.id,
    preferredAudioRouteId: nextPreferences.audioRouteId,
    browserAudioOutputSupported: true,
  });
};

const syncNativeCallState = async (callType?: CallType) => {
  if (!isNativeAndroid) {
    return;
  }

  const state = getCallState();
  const resolvedCallType = callType || state.call?.type || 'audio';
  if (state.call && ACTIVE_NATIVE_AUDIO_PHASES.has(state.phase)) {
    await androidAudioRoute.enterCommunicationMode();
    await syncNativeRoutes(resolvedCallType);
    return;
  }

  await androidAudioRoute.exitCommunicationMode();
  clearNativeAudioState();
};

export { useCallStore };
export type {
  CallAudioRoute,
  CallMediaDevice,
  CallMediaDeviceKind,
  CallPhase,
  CallPresentationMode,
  CallRole,
  CallVideoGeometry,
  CallVideoOrientation,
  MediaPreferences,
  MinimizedCallPosition,
  RecoverySource,
} from '@/features/calls/callController';

export const expandCallView = rootCallController.expandCallView;
export const handleAnswerSignal = rootCallController.handleAnswerSignal;
export const handleIceCandidateSignal = rootCallController.handleIceCandidateSignal;
export const handleIncomingSession = rootCallController.handleIncomingSession;
export const handleOfferSignal = rootCallController.handleOfferSignal;
export const handleReconnectingCall = rootCallController.handleReconnectingCall;
export const hydrateRecoverableCall = rootCallController.hydrateRecoverableCall;
export const minimizeCallView = rootCallController.minimizeCallView;
export const registerCallRemoteAudioElement =
  rootCallController.registerCallRemoteAudioElement;
export const resetCallPresentation = rootCallController.resetCallPresentation;
export const setMinimizedCallPosition = rootCallController.setMinimizedCallPosition;
export const toggleCamera = rootCallController.toggleCamera;
export const toggleMicrophone = rootCallController.toggleMicrophone;

export const refreshCallDevices = async () => {
  await rootCallController.refreshCallDevices();
  await syncNativeCallState();
};

export const setBrowserAudioOutput = async (routeId: string) => {
  if (!isNativeAndroid) {
    return rootCallController.setBrowserAudioOutput(routeId);
  }

  await androidAudioRoute.enterCommunicationMode();
  await androidAudioRoute.setRoute({ id: routeId as AndroidAudioRouteId });
  const nextPreferences = writeCallDevicePreferences({ audioRouteId: routeId });
  setCallState({
    selectedAudioRouteId: routeId,
    preferredAudioRouteId: nextPreferences.audioRouteId,
    browserAudioOutputSupported: true,
  });
  await syncNativeRoutes(getCallState().call?.type || 'audio');
};

export const startCall = async (
  input: Parameters<typeof rootCallController.startCall>[0],
) => {
  await rootCallController.startCall(input);
  await syncNativeCallState(input.type);
};

export const acceptIncomingCall = async () => {
  const callType = getCallState().call?.type;
  await rootCallController.acceptIncomingCall();
  await syncNativeCallState(callType || 'audio');
};

export const handleAcceptedSession = async (
  session: Parameters<typeof rootCallController.handleAcceptedSession>[0],
) => {
  await rootCallController.handleAcceptedSession(session);
  await syncNativeCallState(session.call.type);
};

export const handleConnectedSignal = async (
  payload: Parameters<typeof rootCallController.handleConnectedSignal>[0],
) => {
  rootCallController.handleConnectedSignal(payload);
  await syncNativeCallState();
};

export const handleResumedSession = async (
  session: Parameters<typeof rootCallController.handleResumedSession>[0],
) => {
  await rootCallController.handleResumedSession(session);
  await syncNativeCallState(session.call.type);
};

export const attemptCallRecovery = async (
  source: Parameters<typeof rootCallController.attemptCallRecovery>[0],
) => {
  await rootCallController.attemptCallRecovery(source);
  await syncNativeCallState();
};

export const resumeRecoveredCall = async (
  source: Parameters<typeof rootCallController.resumeRecoveredCall>[0],
) => {
  await rootCallController.resumeRecoveredCall(source);
  await syncNativeCallState();
};

export const switchCamera = async (deviceId: string) => {
  await rootCallController.switchCamera(deviceId);
  await syncNativeRoutes(getCallState().call?.type || 'video');
};

export const switchMicrophone = async (deviceId: string) => {
  await rootCallController.switchMicrophone(deviceId);
  await syncNativeRoutes(getCallState().call?.type || 'audio');
};

export const endCurrentCall = async () => {
  await rootCallController.endCurrentCall();
  await syncNativeCallState();
};

export const rejectIncomingCall = async () => {
  await rootCallController.rejectIncomingCall();
  await syncNativeCallState();
};

export const handleTerminalCall = async (
  payload: Parameters<typeof rootCallController.handleTerminalCall>[0],
) => {
  rootCallController.handleTerminalCall(payload);
  await syncNativeCallState();
};

export const handleRecoveryExpired = async (
  message?: Parameters<typeof rootCallController.handleRecoveryExpired>[0],
) => {
  rootCallController.handleRecoveryExpired(message);
  await syncNativeCallState();
};

export const handleSocketDisconnected = async () => {
  rootCallController.handleSocketDisconnected();
  await syncNativeCallState();
};

export const resetCallController = async () => {
  rootCallController.resetCallController();
  await syncNativeCallState();
};
