/**
 * Mobile Touch & Haptics Engine
 * Implements secondary action feedback from Disney's 12 principles for mobile touch.
 */

export type HapticType = 'selection' | 'light' | 'medium' | 'success' | 'warning' | 'error';

export function triggerHaptic(type: HapticType = 'selection'): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('vibrate' in navigator)) return;

  try {
    switch (type) {
      case 'selection':
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(20);
        break;
      case 'success':
        navigator.vibrate([15, 30, 20]);
        break;
      case 'warning':
        navigator.vibrate([25, 40, 25]);
        break;
      case 'error':
        navigator.vibrate([40, 60, 40]);
        break;
    }
  } catch {
    // Ignore environments where vibrate is restricted or fails
  }
}
