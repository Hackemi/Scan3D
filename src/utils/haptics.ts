/**
 * Mobile Haptic feedback utility
 */
export type HapticType = 'light' | 'medium' | 'success' | 'shutter' | 'tick' | 'countdown' | 'complete';

export function triggerHaptic(type: HapticType = 'light') {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;

  try {
    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'tick':
        navigator.vibrate(15);
        break;
      case 'medium':
        navigator.vibrate(25);
        break;
      case 'countdown':
        navigator.vibrate([15, 20, 15]);
        break;
      case 'shutter':
        navigator.vibrate([30, 40, 20]);
        break;
      case 'success':
      case 'complete':
        navigator.vibrate([40, 50, 60, 50, 120]);
        break;
    }
  } catch (e) {
    // Ignore unsupported
  }
}
