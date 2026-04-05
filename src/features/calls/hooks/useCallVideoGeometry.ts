import { useEffect, useState } from 'react';
import type { CallVideoGeometry, CallVideoOrientation } from '../callStore';

const emptyGeometry: CallVideoGeometry = {
  width: null,
  height: null,
  aspectRatio: null,
  orientation: 'unknown',
};

const getOrientation = (
  width: number | null,
  height: number | null
): CallVideoOrientation => {
  if (!width || !height) {
    return 'unknown';
  }

  if (Math.abs(width - height) < 8) {
    return 'square';
  }

  return width > height ? 'landscape' : 'portrait';
};

const toGeometry = (
  width: number | null,
  height: number | null
): CallVideoGeometry => ({
  width,
  height,
  aspectRatio: width && height ? width / height : null,
  orientation: getOrientation(width, height),
});

const resolveGeometry = (
  stream: MediaStream | null,
  node: HTMLVideoElement | null
) => {
  const videoWidth = node?.videoWidth || null;
  const videoHeight = node?.videoHeight || null;
  if (videoWidth && videoHeight) {
    return toGeometry(videoWidth, videoHeight);
  }

  const trackSettings = stream?.getVideoTracks()[0]?.getSettings();
  const trackWidth =
    typeof trackSettings?.width === 'number' ? trackSettings.width : null;
  const trackHeight =
    typeof trackSettings?.height === 'number' ? trackSettings.height : null;
  return toGeometry(trackWidth, trackHeight);
};

const geometryEquals = (
  left: CallVideoGeometry,
  right: CallVideoGeometry
) =>
  left.width === right.width &&
  left.height === right.height &&
  left.aspectRatio === right.aspectRatio &&
  left.orientation === right.orientation;

export function useCallVideoGeometry(
  stream: MediaStream | null
) {
  const [videoNode, setVideoNode] = useState<HTMLVideoElement | null>(null);
  const [geometry, setGeometry] = useState<CallVideoGeometry>(emptyGeometry);

  useEffect(() => {
    const nextGeometry = resolveGeometry(stream, videoNode);
    setGeometry((currentGeometry) =>
      geometryEquals(currentGeometry, nextGeometry)
        ? currentGeometry
        : nextGeometry
    );
  }, [stream, videoNode]);

  useEffect(() => {
    if (!videoNode && !stream) {
      return;
    }

    const activeVideoTrack =
      stream?.getVideoTracks().find((track) => track.readyState === 'live') ||
      stream?.getVideoTracks()[0] ||
      null;
    let frameId: number | null = null;

    const updateGeometry = () => {
      const nextGeometry = resolveGeometry(stream, videoNode);
      setGeometry((currentGeometry) =>
        geometryEquals(currentGeometry, nextGeometry)
          ? currentGeometry
          : nextGeometry
      );

      if (
        videoNode &&
        (!nextGeometry.width || !nextGeometry.height) &&
        activeVideoTrack &&
        typeof window !== 'undefined'
      ) {
        frameId = window.requestAnimationFrame(updateGeometry);
      }
    };

    updateGeometry();
    videoNode?.addEventListener('loadedmetadata', updateGeometry);
    videoNode?.addEventListener('loadeddata', updateGeometry);
    videoNode?.addEventListener('canplay', updateGeometry);
    videoNode?.addEventListener('resize', updateGeometry as EventListener);
    activeVideoTrack?.addEventListener('unmute', updateGeometry);
    activeVideoTrack?.addEventListener('mute', updateGeometry);
    activeVideoTrack?.addEventListener('ended', updateGeometry);

    return () => {
      if (frameId !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(frameId);
      }

      videoNode?.removeEventListener('loadedmetadata', updateGeometry);
      videoNode?.removeEventListener('loadeddata', updateGeometry);
      videoNode?.removeEventListener('canplay', updateGeometry);
      videoNode?.removeEventListener('resize', updateGeometry as EventListener);
      activeVideoTrack?.removeEventListener('unmute', updateGeometry);
      activeVideoTrack?.removeEventListener('mute', updateGeometry);
      activeVideoTrack?.removeEventListener('ended', updateGeometry);
    };
  }, [stream, videoNode]);

  return {
    geometry: geometryEquals(geometry, emptyGeometry)
      ? resolveGeometry(stream, videoNode)
      : geometry,
    setVideoNode,
  };
}

export default useCallVideoGeometry;
