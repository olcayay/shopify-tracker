import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSoundPreferences, saveSoundPreferences } from "@/lib/notification-sound";

describe("notification-sound", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("getSoundPreferences", () => {
    it("returns defaults when nothing stored", () => {
      const prefs = getSoundPreferences();
      expect(prefs.enabled).toBe(true);
      expect(prefs.volume).toBe(0.5);
      expect(prefs.sound).toBe("default");
      expect(prefs.vibrate).toBe(true);
    });

    it("returns stored preferences", () => {
      localStorage.setItem("notification-sound-prefs", JSON.stringify({
        enabled: false,
        volume: 0.8,
        sound: "chime",
        vibrate: false,
      }));

      const prefs = getSoundPreferences();
      expect(prefs.enabled).toBe(false);
      expect(prefs.volume).toBe(0.8);
      expect(prefs.sound).toBe("chime");
      expect(prefs.vibrate).toBe(false);
    });

    it("handles corrupted localStorage gracefully", () => {
      localStorage.setItem("notification-sound-prefs", "not-json");
      const prefs = getSoundPreferences();
      expect(prefs.enabled).toBe(true); // returns defaults
    });
  });

  describe("saveSoundPreferences", () => {
    it("saves partial preferences", () => {
      saveSoundPreferences({ volume: 0.9 });
      const prefs = getSoundPreferences();
      expect(prefs.volume).toBe(0.9);
      expect(prefs.enabled).toBe(true); // default preserved
    });

    it("overwrites existing values", () => {
      saveSoundPreferences({ sound: "bell" });
      saveSoundPreferences({ sound: "pop" });
      expect(getSoundPreferences().sound).toBe("pop");
    });
  });
});
