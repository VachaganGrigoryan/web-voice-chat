import type {
  CallAudioRoute,
  CallControllerState,
  CallDeviceState,
  CallMediaDevice,
  CallMediaDeviceKind,
} from './callStore';

export type HTMLAudioElementWithSinkId = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

const DEFAULT_DEVICE_ID = 'default';
export type CallCameraFacing = 'front' | 'back' | 'unknown';

export const supportsBrowserAudioOutputSelection = () =>
  typeof HTMLMediaElement !== 'undefined' &&
  typeof (HTMLMediaElement.prototype as HTMLAudioElementWithSinkId).setSinkId === 'function';

export const getTrackDeviceId = (track: MediaStreamTrack | null | undefined) => {
  const deviceId = track?.getSettings?.().deviceId;
  return typeof deviceId === 'string' && deviceId ? deviceId : null;
};

export const isExactDeviceConstraintError = (error: unknown) =>
  error instanceof DOMException &&
  (error.name === 'NotFoundError' || error.name === 'OverconstrainedError');

const normalizeCameraLabel = (label?: string | null) =>
  typeof label === 'string' ? label.trim().toLowerCase() : '';

const FRONT_CAMERA_PATTERN =
  /(front|user|selfie|face|facetime|facing front)/;
const BACK_CAMERA_PATTERN =
  /(rear|back|environment|world|facing back|facing rear)/;
const SECONDARY_CAMERA_PATTERN =
  /(ultra[-\s]?wide|tele|telephoto|macro|depth|periscope|zoom|secondary)/;
const PRIMARY_CAMERA_PATTERN =
  /(^|\b)(main|primary|default|standard)(\b|$)/;

export const getCameraFacingFromLabel = (
  label?: string | null
): CallCameraFacing => {
  const normalized = normalizeCameraLabel(label);
  if (!normalized) {
    return 'unknown';
  }

  if (FRONT_CAMERA_PATTERN.test(normalized)) {
    return 'front';
  }

  if (BACK_CAMERA_PATTERN.test(normalized)) {
    return 'back';
  }

  return 'unknown';
};

export const getCameraFacingFromTrack = (
  track: MediaStreamTrack | null | undefined
): CallCameraFacing => {
  const facingMode = track?.getSettings?.().facingMode;
  if (facingMode === 'user') {
    return 'front';
  }

  if (facingMode === 'environment') {
    return 'back';
  }

  return 'unknown';
};

const getPrimaryCameraRank = (
  camera: Pick<CallMediaDevice, 'label' | 'id'>,
  facing: Exclude<CallCameraFacing, 'unknown'>
) => {
  const normalized = normalizeCameraLabel(camera.label);
  let rank = 0;

  if (!normalized) {
    rank += 100;
  }

  if (facing === 'front') {
    if (!FRONT_CAMERA_PATTERN.test(normalized)) {
      rank += 50;
    }
  } else if (!BACK_CAMERA_PATTERN.test(normalized)) {
    rank += 50;
  }

  if (SECONDARY_CAMERA_PATTERN.test(normalized)) {
    rank += 15;
  }

  if (PRIMARY_CAMERA_PATTERN.test(normalized)) {
    rank -= 5;
  }

  if (/(external|desk|continuity|virtual)/.test(normalized)) {
    rank += 25;
  }

  if (camera.id === DEFAULT_DEVICE_ID) {
    rank -= 2;
  }

  return rank;
};

export const getPrimaryCameraForFacing = (
  cameras: CallMediaDevice[],
  facing: Exclude<CallCameraFacing, 'unknown'>
) =>
  [...cameras]
    .filter((camera) => getCameraFacingFromLabel(camera.label) === facing)
    .sort((left, right) => {
      const rankDifference =
        getPrimaryCameraRank(left, facing) - getPrimaryCameraRank(right, facing);
      if (rankDifference !== 0) {
        return rankDifference;
      }

      return left.label.localeCompare(right.label, undefined, {
        sensitivity: 'base',
      });
    })[0] || null;

export const getQuickSwitchCameraId = ({
  cameras,
  currentCameraId,
  currentFacing,
}: {
  cameras: CallMediaDevice[];
  currentCameraId: string | null;
  currentFacing: CallCameraFacing;
}) => {
  if (cameras.length < 2) {
    return null;
  }

  const primaryFrontCamera = getPrimaryCameraForFacing(cameras, 'front');
  const primaryBackCamera = getPrimaryCameraForFacing(cameras, 'back');
  if (!primaryFrontCamera || !primaryBackCamera) {
    return null;
  }

  const currentCamera =
    cameras.find((camera) => camera.id === currentCameraId) || null;
  const resolvedCurrentFacing =
    currentFacing !== 'unknown'
      ? currentFacing
      : getCameraFacingFromLabel(currentCamera?.label);

  if (resolvedCurrentFacing === 'front') {
    return primaryBackCamera.id;
  }

  if (resolvedCurrentFacing === 'back') {
    return primaryFrontCamera.id;
  }

  if (currentCameraId === primaryFrontCamera.id) {
    return primaryBackCamera.id;
  }

  if (currentCameraId === primaryBackCamera.id) {
    return primaryFrontCamera.id;
  }

  return primaryFrontCamera.id;
};

const sortByLabel = <T extends { label: string; id: string }>(items: T[]) =>
  [...items].sort((left, right) => {
    const leftDefault = left.id === DEFAULT_DEVICE_ID ? 0 : 1;
    const rightDefault = right.id === DEFAULT_DEVICE_ID ? 0 : 1;

    if (leftDefault !== rightDefault) {
      return leftDefault - rightDefault;
    }

    return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' });
  });

export const toCallMediaDevices = (
  devices: MediaDeviceInfo[],
  kind: CallMediaDeviceKind
): CallMediaDevice[] => {
  const matchingDevices = devices.filter((device) => device.kind === kind);

  return sortByLabel(
    matchingDevices.map((device, index) => ({
      id: device.deviceId,
      kind,
      label:
        device.label ||
        (kind === 'audioinput'
          ? `Microphone ${index + 1}`
          : `Camera ${index + 1}`),
    }))
  );
};

export const toBrowserAudioRoutes = (devices: MediaDeviceInfo[]): CallAudioRoute[] =>
  sortByLabel(
    devices
      .filter((device) => device.kind === 'audiooutput')
      .map((device, index) => ({
        id: device.deviceId,
        kind: 'browser-output' as const,
        label:
          device.label ||
          (device.deviceId === DEFAULT_DEVICE_ID
            ? 'System default'
            : `Speaker ${index + 1}`),
        source: 'browser' as const,
      }))
  );

export const getPreferredItemId = <T extends { id: string }>(
  items: T[],
  preferredIds: Array<string | null | undefined>
) => {
  for (const preferredId of preferredIds) {
    if (!preferredId) {
      continue;
    }

    const match = items.find((item) => item.id === preferredId);
    if (match) {
      return match.id;
    }
  }

  return items[0]?.id || null;
};

export const resolveCallDeviceState = (
  state: Pick<
    CallControllerState,
    | 'localStream'
    | 'preferredMicrophoneId'
    | 'preferredCameraId'
    | 'preferredAudioRouteId'
    | 'selectedMicrophoneId'
    | 'selectedCameraId'
    | 'selectedAudioRouteId'
  >,
  devices: MediaDeviceInfo[]
): Pick<
  CallDeviceState,
  | 'availableMicrophones'
  | 'availableCameras'
  | 'availableAudioRoutes'
  | 'selectedMicrophoneId'
  | 'selectedCameraId'
  | 'selectedAudioRouteId'
  | 'browserAudioOutputSupported'
> => {
  const availableMicrophones = toCallMediaDevices(devices, 'audioinput');
  const availableCameras = toCallMediaDevices(devices, 'videoinput');
  const availableAudioRoutes = supportsBrowserAudioOutputSelection()
    ? toBrowserAudioRoutes(devices)
    : [];

  const selectedMicrophoneId = getPreferredItemId(availableMicrophones, [
    state.preferredMicrophoneId,
    getTrackDeviceId(state.localStream?.getAudioTracks()[0]),
    state.selectedMicrophoneId,
    DEFAULT_DEVICE_ID,
  ]);
  const selectedCameraId = getPreferredItemId(availableCameras, [
    state.preferredCameraId,
    getTrackDeviceId(state.localStream?.getVideoTracks()[0]),
    state.selectedCameraId,
    DEFAULT_DEVICE_ID,
  ]);
  const selectedAudioRouteId = getPreferredItemId(availableAudioRoutes, [
    state.preferredAudioRouteId,
    state.selectedAudioRouteId,
    DEFAULT_DEVICE_ID,
  ]);

  return {
    availableMicrophones,
    availableCameras,
    availableAudioRoutes,
    selectedMicrophoneId,
    selectedCameraId,
    selectedAudioRouteId,
    browserAudioOutputSupported: supportsBrowserAudioOutputSelection(),
  };
};

export const getVideoConstraints = (deviceId?: string | null): MediaTrackConstraints =>
  deviceId
    ? {
        deviceId: { exact: deviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      }
    : {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };
