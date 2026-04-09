import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { VideoOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { registerCallRemoteAudioElement } from '../callController';
import { CALL_BRAND_BLACK, getCallBrandColor } from '../callBrand';
import type { CallVideoGeometry } from '../callStore';
import { useCallVideoGeometry } from '../hooks/useCallVideoGeometry';

function bindStreamToElement(
  node: HTMLMediaElement | null,
  stream: MediaStream | null
) {
  if (!node) {
    return;
  }

  if (node.srcObject !== stream) {
    node.srcObject = stream;
  }

  if (!stream) {
    node.pause();
    return;
  }

  void node.play().catch(() => {});
}

function CallBoundVideo({
  stream,
  className,
  muted = false,
  mirrored = false,
  onNodeChange,
}: {
  stream: MediaStream | null;
  className?: string;
  muted?: boolean;
  mirrored?: boolean;
  onNodeChange?: (node: HTMLVideoElement | null) => void;
}) {
  const [node, setNode] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    bindStreamToElement(node, stream);
    return () => {
      if (!node) {
        return;
      }

      node.pause();
      node.srcObject = null;
    };
  }, [node, stream]);

  useEffect(() => {
    onNodeChange?.(node);
  }, [node, onNodeChange]);

  return (
    <video
      ref={setNode}
      autoPlay
      playsInline
      muted={muted}
      className={cn(className, mirrored && 'scale-x-[-1]')}
    />
  );
}

const hasVideoTrack = (stream: MediaStream | null) =>
  !!stream?.getVideoTracks().some((track) => track.readyState === 'live');

const getResolvedAspectRatio = (
  geometry: CallVideoGeometry,
  fallbackAspectRatio: number
) => geometry.aspectRatio || fallbackAspectRatio;

const getMediaFrameStyle = (
  geometry: CallVideoGeometry,
  fallbackAspectRatio: number
): CSSProperties => ({
  aspectRatio: String(getResolvedAspectRatio(geometry, fallbackAspectRatio)),
});

const getMediaFrameClasses = (
  geometry: CallVideoGeometry,
  fallbackAspectRatio: number
) => {
  const aspectRatio = getResolvedAspectRatio(geometry, fallbackAspectRatio);
  return aspectRatio >= 1
    ? 'w-full max-h-full'
    : 'h-full max-w-full';
};

const getPreviewDimensions = (
  geometry: CallVideoGeometry,
  variant: 'expanded' | 'pip',
  isMobileViewport: boolean
) => {
  const fallbackAspectRatio = variant === 'pip' ? 9 / 16 : 3 / 4;
  const aspectRatio = getResolvedAspectRatio(geometry, fallbackAspectRatio);
  const maxWidth = variant === 'pip' ? 112 : isMobileViewport ? 144 : 184;
  const maxHeight = variant === 'pip' ? 148 : isMobileViewport ? 220 : 280;
  let width = maxWidth;
  let height = Math.round(width / aspectRatio);

  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * aspectRatio);
  }

  return {
    width,
    height,
  };
};

export function CallMediaSurface({
  stream,
  className,
  contentClassName,
  muted = false,
  mirrored = false,
  fallback,
  children,
  fallbackAspectRatio = 16 / 9,
}: {
  stream: MediaStream | null;
  className?: string;
  contentClassName?: string;
  muted?: boolean;
  mirrored?: boolean;
  fallback?: ReactNode;
  children?: ReactNode;
  fallbackAspectRatio?: number;
}) {
  const { geometry, setVideoNode } = useCallVideoGeometry(stream);
  const hasVideo = hasVideoTrack(stream);
  const overlayStyle = {
    background: `radial-gradient(circle at top, ${getCallBrandColor(0.18)}, transparent 48%), linear-gradient(180deg, rgba(10, 10, 10, 0.18), rgba(10, 10, 10, 0.88))`,
  };

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{ backgroundColor: CALL_BRAND_BLACK }}
    >
      {hasVideo ? (
        <>
          <CallBoundVideo
            stream={stream}
            muted={muted}
            mirrored={mirrored}
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
          />
          <div className="absolute inset-0" style={overlayStyle} />
          <div
            className={cn(
              'absolute inset-0 flex items-center justify-center p-4 sm:p-6',
              contentClassName
            )}
          >
            <div
              className={cn(
                'relative overflow-hidden',
                getMediaFrameClasses(geometry, fallbackAspectRatio)
              )}
              style={getMediaFrameStyle(geometry, fallbackAspectRatio)}
            >
              <CallBoundVideo
                stream={stream}
                muted={muted}
                mirrored={mirrored}
                onNodeChange={setVideoNode}
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        </>
      ) : (
        fallback
      )}

      {children}
    </div>
  );
}

export function CallFloatingSelfPreview({
  stream,
  isCameraEnabled,
  isMobileViewport,
  variant = 'expanded',
  className,
  children,
}: {
  stream: MediaStream | null;
  isCameraEnabled: boolean;
  isMobileViewport: boolean;
  variant?: 'expanded' | 'pip';
  className?: string;
  children?: ReactNode;
}) {
  const { geometry, setVideoNode } = useCallVideoGeometry(stream);
  const { width, height } = getPreviewDimensions(
    geometry,
    variant,
    isMobileViewport
  );

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[26px] border border-white/10 bg-black/92 shadow-2xl backdrop-blur-xl',
        className
      )}
      style={{
        width,
        height,
        boxShadow: `0 24px 60px ${getCallBrandColor(0.22)}`,
      }}
    >
      {stream && isCameraEnabled && hasVideoTrack(stream) ? (
        <>
          <CallBoundVideo
            stream={stream}
            muted
            mirrored
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-xl"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, rgba(10, 10, 10, 0.04), rgba(10, 10, 10, 0.62))`,
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center p-2">
            <div
              className={cn(
                'relative overflow-hidden',
                getMediaFrameClasses(geometry, 3 / 4)
              )}
              style={getMediaFrameStyle(geometry, 3 / 4)}
            >
              <CallBoundVideo
                stream={stream}
                muted
                mirrored
                onNodeChange={setVideoNode}
                className="h-full w-full object-contain"
              />
            </div>
          </div>
          <div
            className="absolute inset-x-0 top-0 h-12"
            style={{
              background: `linear-gradient(180deg, ${getCallBrandColor(0.18)}, transparent)`,
            }}
          />
        </>
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-white/70"
          style={{ backgroundColor: CALL_BRAND_BLACK }}
        >
          <VideoOff className={cn(variant === 'pip' ? 'h-4 w-4' : 'h-6 w-6')} />
        </div>
      )}

      {children}
    </div>
  );
}

export function CallRemoteAudio({ stream }: { stream: MediaStream | null }) {
  const [node, setNode] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    registerCallRemoteAudioElement(node);

    return () => {
      registerCallRemoteAudioElement(null);
    };
  }, [node]);

  useEffect(() => {
    bindStreamToElement(node, stream);
    return () => {
      if (!node) {
        return;
      }

      node.pause();
      node.srcObject = null;
    };
  }, [node, stream]);

  return <audio ref={setNode} autoPlay playsInline className="hidden" />;
}
