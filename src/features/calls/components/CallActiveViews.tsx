import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  FlipHorizontal2,
  Loader2,
  Maximize2,
  Minimize2,
  Settings2,
  Mic,
  MicOff,
  PhoneOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { LogoSymbol } from '@/shared/branding/LogoSymbol';
import {
  endCurrentCall,
  expandCallView,
  minimizeCallView,
  setBrowserAudioOutput,
  setMinimizedCallPosition,
  switchCamera,
  toggleCamera,
  toggleMicrophone,
  useCallStore,
} from '../callController';
import {
  getCameraFacingFromTrack,
  getQuickSwitchCameraId,
} from '../callDevices';
import { CALL_BRAND_PRIMARY, getCallBrandColor } from '../callBrand';
import { CallControlDock } from './CallControlDock';
import { CallDeviceSheet } from './CallDeviceSheet';
import { CallFloatingSelfPreview, CallMediaSurface } from './CallMedia';
import { CallPeerAvatar, getAvatarUrl, getPeerLabel, useIsMobileViewport } from './callUi';

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
const CALL_GLASS_SURFACE_STYLE: CSSProperties = {
  backgroundColor: 'rgba(10, 10, 10, 0.42)',
  boxShadow: `0 24px 60px ${getCallBrandColor(0.2)}`,
};
const CALL_FLOATING_ACTION_STYLE: CSSProperties = {
  backgroundColor: 'rgba(10, 10, 10, 0.44)',
  boxShadow: `0 18px 44px ${getCallBrandColor(0.16)}`,
};
const CALL_AUDIO_BACKGROUND_STYLE: CSSProperties = {
  background: `radial-gradient(circle at top, ${getCallBrandColor(0.18)}, rgba(10, 10, 10, 0.98) 74%)`,
};
const CALL_AUDIO_TOP_GLOW_STYLE: CSSProperties = {
  background: `radial-gradient(circle at top, ${getCallBrandColor(0.26)}, transparent 62%)`,
};
const CALL_AUDIO_ORB_STYLE: CSSProperties = {
  backgroundColor: getCallBrandColor(0.12),
};

const getActiveToggleStyle = (active: boolean) =>
  active
    ? ({
        backgroundColor: CALL_BRAND_PRIMARY,
      } satisfies CSSProperties)
    : undefined;

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

function ActiveVideoFallback({
  peerLabel,
  avatarUrl,
  statusLabel,
}: {
  peerLabel: string;
  avatarUrl?: string;
  statusLabel: string;
}) {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at top, ${getCallBrandColor(0.28)}, transparent 42%), linear-gradient(180deg, rgba(10, 10, 10, 0.84), rgba(10, 10, 10, 0.98))`,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="flex flex-col items-center text-center">
          <div
            className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 backdrop-blur-md"
            style={CALL_GLASS_SURFACE_STYLE}
          >
            <LogoSymbol size="sm" />
          </div>
          <CallPeerAvatar
            peerLabel={peerLabel}
            avatarUrl={avatarUrl}
            className="h-28 w-28 border-2 border-white/15 shadow-2xl"
            fallbackClassName="text-4xl"
          />
          <div className="mt-6 text-3xl font-semibold tracking-tight">{peerLabel}</div>
          <div className="mt-2 text-sm text-white/65">{statusLabel}</div>
        </div>
      </div>
    </>
  );
}

export function ActiveCallView({
  isVideoCall,
}: {
  isVideoCall: boolean;
}) {
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
  const hasRemoteVideo =
    isVideoCall &&
    !!remoteStream?.getVideoTracks().some((track) => track.readyState === 'live');
  const hasMicChoices = availableMicrophones.length > 1;
  const hasCameraChoices = isVideoCall && availableCameras.length > 1;
  const hasAudioRouteChoices = availableAudioRoutes.length > 1;
  const hasDeviceSheet = hasMicChoices || hasAudioRouteChoices;
  const canMinimize = phase === 'connecting' || phase === 'active';
  const canQuickSwitchSpeaker = isMobileViewport && hasAudioRouteChoices;
  const canQuickSwitchCamera = hasCameraChoices;

  const openSettingsSheet = () => {
    if (!hasDeviceSheet) {
      toast.info('No extra microphone or speaker options are available right now.');
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
    const currentFacing = getCameraFacingFromTrack(
      localStream?.getVideoTracks()[0]
    );
    const nextCameraId = getQuickSwitchCameraId({
      cameras: availableCameras,
      currentCameraId: selectedCameraId,
      currentFacing,
    });
    if (!nextCameraId) {
      toast.info('No alternate front or back camera is available right now.');
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

  if (isVideoCall) {
    return (
      <div className="fixed inset-0 z-[80] overflow-hidden bg-black text-white">
        <CallMediaSurface
          stream={hasRemoteVideo ? remoteStream : null}
          muted
          className="absolute inset-0"
          fallback={
            <ActiveVideoFallback
              peerLabel={peerLabel}
              avatarUrl={avatarUrl}
              statusLabel={statusLabel}
            />
          }
        />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-6">
          <div
            className="flex items-center gap-3 rounded-[28px] border border-white/10 px-4 py-3 backdrop-blur-md"
            style={CALL_GLASS_SURFACE_STYLE}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/10 bg-white/5">
              <LogoSymbol size="sm" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
                {call?.type === 'video' ? 'Video call' : 'Audio call'}
              </div>
              <div className="mt-1 text-base font-semibold">{peerLabel}</div>
              <div className="mt-0.5 text-sm text-white/65">{statusLabel}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasDeviceSheet ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-12 w-12 rounded-2xl border border-white/10 text-white hover:opacity-95"
                style={CALL_FLOATING_ACTION_STYLE}
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
                className="h-12 w-12 rounded-2xl border border-white/10 text-white hover:opacity-95"
                style={CALL_FLOATING_ACTION_STYLE}
                onClick={minimizeCallView}
              >
                <Minimize2 className="h-5 w-5" />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="absolute bottom-28 right-4 sm:bottom-32 sm:right-6">
          <CallFloatingSelfPreview
            stream={localStream}
            isCameraEnabled={isCameraEnabled}
            isMobileViewport={isMobileViewport}
            className="border-white/12"
          >
            <div className="absolute bottom-2 left-2 rounded-full border border-white/10 bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/72 backdrop-blur-md">
              You
            </div>
            {canQuickSwitchCamera ? (
              <button
                type="button"
                className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white backdrop-blur-md transition-colors hover:opacity-95 disabled:opacity-60"
                style={CALL_FLOATING_ACTION_STYLE}
                onClick={() => void cycleCamera()}
                disabled={isCyclingCamera}
                aria-label="Switch camera"
                title="Switch between the main front and back cameras"
              >
                {isCyclingCamera ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FlipHorizontal2 className="h-4 w-4" />
                )}
              </button>
            ) : null}
          </CallFloatingSelfPreview>
        </div>

        <CallControlDock
          isVideoCall
          isMicMuted={isMicMuted}
          isCameraEnabled={isCameraEnabled}
          isEnding={isEnding}
          speakerActive={hasAudioRouteChoices || !!selectedAudioRouteId}
          isCyclingSpeaker={isCyclingSpeaker}
          onToggleMicrophone={toggleMicrophone}
          onToggleCamera={toggleCamera}
          onSpeakerPress={() => void (canQuickSwitchSpeaker ? cycleSpeakerOutput() : openSpeakerSheet())}
          onEndCall={() => void endCurrentCall()}
        />

        <CallDeviceSheet
          open={isDeviceSheetOpen}
          onOpenChange={setIsDeviceSheetOpen}
          isVideoCall
        />
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[80] overflow-hidden text-white"
      style={CALL_AUDIO_BACKGROUND_STYLE}
    >
      <div className="absolute inset-x-0 top-0 h-64" style={CALL_AUDIO_TOP_GLOW_STYLE} />
      <div
        className="absolute bottom-[-8rem] right-[-4rem] h-64 w-64 rounded-full blur-3xl"
        style={CALL_AUDIO_ORB_STYLE}
      />
      <div
        className="absolute left-[-6rem] top-1/3 h-72 w-72 rounded-full blur-3xl"
        style={CALL_AUDIO_ORB_STYLE}
      />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4 sm:p-6">
        <div
          className="flex items-center gap-3 rounded-[28px] border border-white/10 px-4 py-3 backdrop-blur-md"
          style={CALL_GLASS_SURFACE_STYLE}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/10 bg-white/5">
            <LogoSymbol size="sm" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
              Audio call
            </div>
            <div className="mt-1 text-base font-semibold">{peerLabel}</div>
            <div className="mt-0.5 text-sm text-white/65">{statusLabel}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasDeviceSheet ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-12 w-12 rounded-2xl border border-white/10 text-white hover:opacity-95"
              style={CALL_FLOATING_ACTION_STYLE}
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
              className="h-12 w-12 rounded-2xl border border-white/10 text-white hover:opacity-95"
              style={CALL_FLOATING_ACTION_STYLE}
              onClick={minimizeCallView}
            >
              <Minimize2 className="h-5 w-5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative flex h-full items-center justify-center px-6 pb-28 pt-24">
        <div
          className="w-full max-w-xl rounded-[40px] border border-white/10 px-8 py-10 shadow-2xl backdrop-blur-xl"
          style={CALL_GLASS_SURFACE_STYLE}
        >
          <div className="flex flex-col items-center text-center">
            <CallPeerAvatar
              peerLabel={peerLabel}
              avatarUrl={avatarUrl}
              className="h-32 w-32 border-2 border-white/15 shadow-xl"
              fallbackClassName="text-5xl"
            />
            <div className="mt-7 text-3xl font-semibold tracking-tight">{peerLabel}</div>
            <div className="mt-2 text-sm text-white/70">{statusLabel}</div>

            {hasDeviceSheet ? (
              <button
                type="button"
                className="mt-6 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white/70 transition-colors hover:bg-white/10"
                onClick={openSettingsSheet}
              >
                Open device controls
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <CallControlDock
        isVideoCall={false}
        isMicMuted={isMicMuted}
        isCameraEnabled={false}
        isEnding={isEnding}
        speakerActive={hasAudioRouteChoices || !!selectedAudioRouteId}
        isCyclingSpeaker={isCyclingSpeaker}
        onToggleMicrophone={toggleMicrophone}
        onToggleCamera={toggleCamera}
        onSpeakerPress={() => void (canQuickSwitchSpeaker ? cycleSpeakerOutput() : openSpeakerSheet())}
        onEndCall={() => void endCurrentCall()}
      />

      <CallDeviceSheet
        open={isDeviceSheetOpen}
        onOpenChange={setIsDeviceSheetOpen}
        isVideoCall={false}
      />
    </div>
  );
}

export function MinimizedCallPip() {
  const phase = useCallStore((state) => state.phase);
  const call = useCallStore((state) => state.call);
  const peerUser = useCallStore((state) => state.peerUser);
  const remoteStream = useCallStore((state) => state.remoteStream);
  const isMicMuted = useCallStore((state) => state.isMicMuted);
  const isEnding = useCallStore((state) => state.isEnding);
  const minimizedCallPosition = useCallStore((state) => state.minimizedCallPosition);
  const isVideoCall = call?.type === 'video';
  const hasRemoteVideo =
    isVideoCall &&
    !!remoteStream?.getVideoTracks().some((track) => track.readyState === 'live');
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
      ? clampMinimizedCallPosition(minimizedCallPosition, {
          width: rect.width,
          height: rect.height,
        })
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
  const cardStyle = {
    ...(positionStyle || {}),
    backgroundColor: 'rgba(10, 10, 10, 0.92)',
    boxShadow: `0 28px 80px ${getCallBrandColor(0.22)}`,
  };

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
        'fixed z-[95] select-none touch-none overflow-hidden rounded-[30px] border border-white/10 text-white shadow-2xl backdrop-blur-xl',
        'w-[11.75rem] max-w-[calc(100vw-2rem)] sm:w-56',
        isVideoCall ? 'h-[15.75rem] sm:h-72' : 'min-h-[11rem]',
        positionClassName,
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      )}
      style={cardStyle}
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
          <CallMediaSurface
            stream={hasRemoteVideo ? remoteStream : null}
            muted
            className="absolute inset-0"
            contentClassName="p-3"
            fallback={
              <>
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(circle at top, ${getCallBrandColor(0.32)}, transparent 42%), linear-gradient(180deg, rgba(10, 10, 10, 0.9), rgba(10, 10, 10, 0.98))`,
                  }}
                />
                <div className="absolute inset-x-0 top-6 flex flex-col items-center px-4 text-center">
                  <CallPeerAvatar
                    peerLabel={peerLabel}
                    avatarUrl={avatarUrl}
                    className="h-16 w-16 border border-white/15 shadow-lg"
                    fallbackClassName="text-xl"
                  />
                </div>
              </>
            }
          />

          <div
            className="absolute left-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md"
            style={{ boxShadow: `0 12px 36px ${getCallBrandColor(0.18)}` }}
          >
            <LogoSymbol size="sm" />
          </div>

          <div className="absolute inset-x-0 bottom-0 p-3">
            <div
              className="rounded-[24px] border border-white/10 p-3 backdrop-blur-md"
              style={CALL_GLASS_SURFACE_STYLE}
            >
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
                    !isMicMuted && 'text-white hover:opacity-95'
                  )}
                  style={getActiveToggleStyle(!isMicMuted)}
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
                  {isEnding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PhoneOff className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="flex h-full flex-col p-4"
          style={{
            background: `radial-gradient(circle at top, ${getCallBrandColor(0.18)}, transparent 58%), linear-gradient(180deg, rgba(10, 10, 10, 0.96), rgba(10, 10, 10, 0.98))`,
          }}
        >
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div
              className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md"
              style={{ boxShadow: `0 12px 36px ${getCallBrandColor(0.18)}` }}
            >
              <LogoSymbol size="sm" />
            </div>
            <CallPeerAvatar
              peerLabel={peerLabel}
              avatarUrl={avatarUrl}
              className="h-16 w-16 border border-white/15 shadow-lg"
              fallbackClassName="text-xl"
            />
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
                !isMicMuted && 'text-white hover:opacity-95'
              )}
              style={getActiveToggleStyle(!isMicMuted)}
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
              {isEnding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PhoneOff className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
