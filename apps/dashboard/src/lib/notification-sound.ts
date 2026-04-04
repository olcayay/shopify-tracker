/**
 * Notification sound and vibration preferences (PLA-703).
 * Plays a sound and/or vibrates when a notification arrives.
 * Preferences stored in localStorage.
 */

const PREFS_KEY = "notification-sound-prefs";

export interface SoundPreferences {
  enabled: boolean;
  volume: number; // 0-1
  sound: "default" | "chime" | "bell" | "pop" | "none";
  vibrate: boolean;
}

const DEFAULT_PREFS: SoundPreferences = {
  enabled: true,
  volume: 0.5,
  sound: "default",
  vibrate: true,
};

/**
 * Get current sound preferences.
 */
export function getSoundPreferences(): SoundPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

/**
 * Save sound preferences.
 */
export function saveSoundPreferences(prefs: Partial<SoundPreferences>): void {
  if (typeof window === "undefined") return;
  const current = getSoundPreferences();
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
}

/**
 * Play a notification sound.
 */
export function playNotificationSound(): void {
  const prefs = getSoundPreferences();
  if (!prefs.enabled || prefs.sound === "none") return;

  try {
    // Use Web Audio API for a simple notification tone
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Different tones for different sounds
    const frequencies: Record<string, number> = {
      default: 800,
      chime: 1200,
      bell: 600,
      pop: 1000,
    };

    oscillator.frequency.setValueAtTime(
      frequencies[prefs.sound] || 800,
      ctx.currentTime
    );
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(prefs.volume * 0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio not available (e.g., no user gesture yet)
  }
}

/**
 * Vibrate the device (mobile only).
 */
export function vibrateDevice(): void {
  const prefs = getSoundPreferences();
  if (!prefs.vibrate) return;

  try {
    if ("vibrate" in navigator) {
      navigator.vibrate([100, 50, 100]); // short-pause-short pattern
    }
  } catch {
    // Vibration not supported
  }
}

/**
 * Play sound and vibrate for a notification.
 */
export function notifyUser(): void {
  playNotificationSound();
  vibrateDevice();
}
