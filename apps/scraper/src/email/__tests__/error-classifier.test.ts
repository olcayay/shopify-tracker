import { describe, it, expect } from "vitest";
import { classifyEmailError } from "../error-classifier.js";

describe("classifyEmailError", () => {
  describe("provider_down errors", () => {
    it("classifies ECONNREFUSED as provider_down", () => {
      const err = new Error("connect ECONNREFUSED 127.0.0.1:587");
      (err as any).code = "ECONNREFUSED";
      expect(classifyEmailError(err)).toBe("provider_down");
    });

    it("classifies ETIMEDOUT as provider_down", () => {
      const err = new Error("connect ETIMEDOUT");
      (err as any).code = "ETIMEDOUT";
      expect(classifyEmailError(err)).toBe("provider_down");
    });

    it("classifies ECONNRESET as provider_down", () => {
      const err = new Error("read ECONNRESET");
      (err as any).code = "ECONNRESET";
      expect(classifyEmailError(err)).toBe("provider_down");
    });

    it("classifies connection timeout message as provider_down", () => {
      expect(classifyEmailError(new Error("Connection timeout"))).toBe("provider_down");
    });

    it("classifies socket hang up as provider_down", () => {
      expect(classifyEmailError(new Error("socket hang up"))).toBe("provider_down");
    });

    it("classifies DNS lookup failure as provider_down", () => {
      expect(classifyEmailError(new Error("getaddrinfo ENOTFOUND smtp.example.com"))).toBe("provider_down");
    });

    it("classifies ALL_PROVIDERS_DOWN code as provider_down", () => {
      const err = new Error("All SMTP providers are unavailable");
      (err as any).code = "ALL_PROVIDERS_DOWN";
      expect(classifyEmailError(err)).toBe("provider_down");
    });

    it("classifies EHOSTUNREACH as provider_down", () => {
      expect(classifyEmailError(new Error("connect EHOSTUNREACH"))).toBe("provider_down");
    });

    it("classifies ENETUNREACH as provider_down", () => {
      expect(classifyEmailError(new Error("connect ENETUNREACH"))).toBe("provider_down");
    });
  });

  describe("permanent errors", () => {
    it("classifies 550 SMTP code as permanent", () => {
      expect(classifyEmailError(new Error("550 5.1.1 User unknown"))).toBe("permanent");
    });

    it("classifies 553 SMTP code as permanent", () => {
      expect(classifyEmailError(new Error("553 Mailbox name not allowed"))).toBe("permanent");
    });

    it("classifies 554 SMTP code as permanent", () => {
      expect(classifyEmailError(new Error("554 Transaction failed"))).toBe("permanent");
    });

    it("classifies invalid email pattern as permanent", () => {
      expect(classifyEmailError(new Error("Invalid email address"))).toBe("permanent");
    });

    it("classifies mailbox not found as permanent", () => {
      expect(classifyEmailError(new Error("Mailbox not found"))).toBe("permanent");
    });

    it("classifies authentication failed as permanent", () => {
      expect(classifyEmailError(new Error("Authentication failed"))).toBe("permanent");
    });

    it("classifies relay access denied as permanent", () => {
      expect(classifyEmailError(new Error("Relay access denied"))).toBe("permanent");
    });

    it("classifies user unknown as permanent", () => {
      expect(classifyEmailError(new Error("User unknown in virtual mailbox table"))).toBe("permanent");
    });

    it("classifies no such user as permanent", () => {
      expect(classifyEmailError(new Error("No such user here"))).toBe("permanent");
    });

    it("classifies 552 (storage exceeded) as permanent", () => {
      expect(classifyEmailError(new Error("552 Exceeded storage allocation"))).toBe("permanent");
    });
  });

  describe("transient errors", () => {
    it("classifies 421 SMTP code as transient", () => {
      expect(classifyEmailError(new Error("421 Service not available, try later"))).toBe("transient");
    });

    it("classifies 450 SMTP code as transient", () => {
      expect(classifyEmailError(new Error("450 Mailbox temporarily unavailable"))).toBe("transient");
    });

    it("classifies 451 SMTP code as transient", () => {
      expect(classifyEmailError(new Error("451 Local error in processing"))).toBe("transient");
    });

    it("classifies 452 SMTP code as transient", () => {
      expect(classifyEmailError(new Error("452 Insufficient system storage"))).toBe("transient");
    });

    it("classifies rate limit as transient", () => {
      expect(classifyEmailError(new Error("Rate limit exceeded"))).toBe("transient");
    });

    it("classifies too many connections as transient", () => {
      expect(classifyEmailError(new Error("Too many connections"))).toBe("transient");
    });

    it("classifies greylisted as transient", () => {
      expect(classifyEmailError(new Error("Greylisted, please try again"))).toBe("transient");
    });

    it("classifies try again later as transient", () => {
      expect(classifyEmailError(new Error("Please try again later"))).toBe("transient");
    });
  });

  describe("default behavior", () => {
    it("classifies unknown errors as transient (safe default)", () => {
      expect(classifyEmailError(new Error("Something unexpected happened"))).toBe("transient");
    });

    it("handles string errors", () => {
      expect(classifyEmailError("connect ECONNREFUSED 127.0.0.1:587")).toBe("provider_down");
    });

    it("handles non-error objects", () => {
      expect(classifyEmailError({ message: "550 User unknown" })).toBe("transient");
    });
  });

  describe("edge cases", () => {
    it("prioritizes error code over message for system errors", () => {
      const err = new Error("Some random message about 550");
      (err as any).code = "ECONNREFUSED";
      expect(classifyEmailError(err)).toBe("provider_down");
    });

    it("classifies 556 SMTP code as permanent", () => {
      expect(classifyEmailError(new Error("556 Domain does not accept mail"))).toBe("permanent");
    });
  });
});
