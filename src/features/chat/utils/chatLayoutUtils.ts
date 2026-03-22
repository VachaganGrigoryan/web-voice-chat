export type ThreadPanelMode = 'minimal' | 'center' | 'full';

export const MOBILE_BREAKPOINT = 768;
export const THREAD_PANEL_MODES: ThreadPanelMode[] = ['minimal', 'center', 'full'];

export function getThreadPanelWidths(containerWidth: number): Record<ThreadPanelMode, number> {
  const safeWidth = Math.max(containerWidth, 720);
  const minMainWidth = 360;
  const maxThreadWidth = Math.max(320, safeWidth - minMainWidth);
  const preferredWidths: Record<ThreadPanelMode, number> = {
    minimal: Math.round(safeWidth * 0.32),
    center: Math.round(safeWidth * 0.4),
    full: Math.round(safeWidth * 0.48),
  };

  return THREAD_PANEL_MODES.reduce(
    (widths, mode) => ({
      ...widths,
      [mode]: Math.min(maxThreadWidth, Math.max(320, preferredWidths[mode])),
    }),
    {} as Record<ThreadPanelMode, number>
  );
}
