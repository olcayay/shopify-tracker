import { describe, it, expect, vi, beforeEach } from "vitest";
import { isFcmConfigured, isApnsConfigured, getMobilePushStatus, sendFcmPush } from "../../notifications/mobile-push.js";

describe("Mobile Push", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  describe("isFcmConfigured", () => {
    it("returns false when env vars not set", () => {
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.FIREBASE_PRIVATE_KEY;
      delete process.env.FIREBASE_CLIENT_EMAIL;
      expect(isFcmConfigured()).toBe(false);
    });

    it("returns true when all env vars set", () => {
      vi.stubEnv("FIREBASE_PROJECT_ID", "my-project");
      vi.stubEnv("FIREBASE_PRIVATE_KEY", "key");
      vi.stubEnv("FIREBASE_CLIENT_EMAIL", "email@test.com");
      expect(isFcmConfigured()).toBe(true);
    });

    it("returns false when partial env vars", () => {
      vi.stubEnv("FIREBASE_PROJECT_ID", "my-project");
      delete process.env.FIREBASE_PRIVATE_KEY;
      delete process.env.FIREBASE_CLIENT_EMAIL;
      expect(isFcmConfigured()).toBe(false);
    });
  });

  describe("isApnsConfigured", () => {
    it("returns false when env vars not set", () => {
      delete process.env.APNS_KEY_ID;
      delete process.env.APNS_TEAM_ID;
      delete process.env.APNS_PRIVATE_KEY;
      delete process.env.APNS_BUNDLE_ID;
      expect(isApnsConfigured()).toBe(false);
    });

    it("returns true when all env vars set", () => {
      vi.stubEnv("APNS_KEY_ID", "key-id");
      vi.stubEnv("APNS_TEAM_ID", "team-id");
      vi.stubEnv("APNS_PRIVATE_KEY", "private-key");
      vi.stubEnv("APNS_BUNDLE_ID", "com.appranks.app");
      expect(isApnsConfigured()).toBe(true);
    });
  });

  describe("getMobilePushStatus", () => {
    it("returns configured status", () => {
      vi.stubEnv("FIREBASE_PROJECT_ID", "my-project");
      vi.stubEnv("FIREBASE_PRIVATE_KEY", "key");
      vi.stubEnv("FIREBASE_CLIENT_EMAIL", "email@test.com");
      delete process.env.APNS_KEY_ID;

      const status = getMobilePushStatus();
      expect(status.fcm.configured).toBe(true);
      expect(status.fcm.projectId).toBe("my-project");
      expect(status.apns.configured).toBe(false);
    });
  });

  describe("sendFcmPush", () => {
    it("returns error when FCM not configured", async () => {
      delete process.env.FIREBASE_PROJECT_ID;
      delete process.env.FIREBASE_PRIVATE_KEY;
      delete process.env.FIREBASE_CLIENT_EMAIL;

      const result = await sendFcmPush("token123", {
        title: "Test",
        body: "Test body",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("not configured");
      expect(result.provider).toBe("fcm");
    });
  });
});
