export type HapticPattern = 'send' | 'reaction' | 'destructive';

const PATTERNS: Record<HapticPattern, number | number[]> = {
  send: 10,
  reaction: 10,
  destructive: [10, 40, 10],
};

export function triggerHaptic(pattern: HapticPattern) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }

  navigator.vibrate(PATTERNS[pattern]);
}
