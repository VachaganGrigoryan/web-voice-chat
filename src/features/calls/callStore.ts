import { create } from 'zustand';
import type {
  CallDoc,
  CallPeerUserSummary,
  CallType,
  IceServer,
} from '@/api/types';
import {
  readCallDevicePreferences,
  type CallPreferredDeviceIds,
} from './callDevicePreferences';
import { supportsBrowserAudioOutputSelection } from './callDevices';

export type CallPhase =
  | 'idle'
  | 'outgoing-ringing'
  | 'incoming-ringing'
  | 'connecting'
  | 'active'
  | 'reconnecting'
  | 'ended'
  | 'ending'
  | 'failed';

export type CallRole = 'caller' | 'callee' | null;
export type RecoverySource =
  | 'page-load'
  | 'socket-connect'
  | 'manual'
  | 'recovery-available';
export type LocalTerminalAction = 'reject' | 'end' | null;
export type CallPresentationMode = 'expanded' | 'minimized';
export type CallMediaDeviceKind = 'audioinput' | 'videoinput';
export type CallVideoOrientation =
  | 'portrait'
  | 'landscape'
  | 'square'
  | 'unknown';

export interface CallMediaDevice {
  id: string;
  kind: CallMediaDeviceKind;
  label: string;
}

export interface CallAudioRoute {
  id: string;
  kind: 'browser-output';
  label: string;
  source: 'browser';
}

export interface MediaPreferences {
  micMuted: boolean;
  cameraEnabled: boolean;
}

export interface CallVideoGeometry {
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  orientation: CallVideoOrientation;
}

export interface CallDeviceState {
  availableMicrophones: CallMediaDevice[];
  availableCameras: CallMediaDevice[];
  availableAudioRoutes: CallAudioRoute[];
  selectedMicrophoneId: string | null;
  selectedCameraId: string | null;
  selectedAudioRouteId: string | null;
  preferredMicrophoneId: string | null;
  preferredCameraId: string | null;
  preferredAudioRouteId: string | null;
  browserAudioOutputSupported: boolean;
}

export interface MinimizedCallPosition {
  x: number;
  y: number;
}

export interface CallControllerState {
  phase: CallPhase;
  callPresentationMode: CallPresentationMode;
  minimizedCallPosition: MinimizedCallPosition | null;
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
  availableMicrophones: CallMediaDevice[];
  availableCameras: CallMediaDevice[];
  availableAudioRoutes: CallAudioRoute[];
  selectedMicrophoneId: string | null;
  selectedCameraId: string | null;
  selectedAudioRouteId: string | null;
  preferredMicrophoneId: string | null;
  preferredCameraId: string | null;
  preferredAudioRouteId: string | null;
  browserAudioOutputSupported: boolean;
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
  terminalFallbackTimeoutId: number | null;
  pendingTerminalActionId: number | null;
  terminalDisplayTimeoutId: number | null;
  endScreenMessage: string | null;
  error: string | null;
}

export const initialMediaPreferences: MediaPreferences = {
  micMuted: false,
  cameraEnabled: false,
};

const createInitialDevicePreferenceState = (
  preferences: CallPreferredDeviceIds
): CallDeviceState => ({
  availableMicrophones: [],
  availableCameras: [],
  availableAudioRoutes: [],
  selectedMicrophoneId: null,
  selectedCameraId: null,
  selectedAudioRouteId: null,
  preferredMicrophoneId: preferences.microphoneId,
  preferredCameraId: preferences.cameraId,
  preferredAudioRouteId: preferences.audioRouteId,
  browserAudioOutputSupported: supportsBrowserAudioOutputSelection(),
});

export const createInitialDeviceState = (): CallDeviceState =>
  createInitialDevicePreferenceState(readCallDevicePreferences());

export const createInitialCallState = (): CallControllerState => ({
  phase: 'idle',
  callPresentationMode: 'expanded',
  minimizedCallPosition: null,
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
  ...createInitialDeviceState(),
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
  terminalFallbackTimeoutId: null,
  pendingTerminalActionId: null,
  terminalDisplayTimeoutId: null,
  endScreenMessage: null,
  error: null,
});

export const useCallStore = create<CallControllerState>(() => createInitialCallState());

export const getCallState = () => useCallStore.getState();
export const setCallState = (patch: Partial<CallControllerState>) =>
  useCallStore.setState(patch);
export const resetCallStore = () => useCallStore.setState(createInitialCallState());
