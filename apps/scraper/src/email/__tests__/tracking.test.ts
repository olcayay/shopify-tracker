import { describe, it, expect } from "vitest";
import {
  generateUnsubscribeToken,
  injectTracking,
  rewriteLinks,
  buildUnsubscribeHeaders,
  buildUnsubscribeUrl,
} from "../tracking.js";

describe("email tracking", () => {
  describe("generateUnsubscribeToken", () => {
    it("generates a 64-char hex string", () => {
      const token = generateUnsubscribeToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it("generates unique tokens", () => {
      const t1 = generateUnsubscribeToken();
      const t2 = generateUnsubscribeToken();
      expect(t1).not.toBe(t2);
    });
  });

  describe("injectTracking", () => {
    it("injects pixel before </body>", () => {
      const html = "<html><body><p>Hello</p></body></html>";
      const result = injectTracking(html, "log-123");
      expect(result).toContain("/api/emails/track/open/log-123.png");
      expect(result).toContain('width="1"');
      expect(result).toContain('height="1"');
      expect(result.indexOf("img")).toBeLessThan(result.indexOf("</body>"));
    });

    it("appends pixel when no </body>", () => {
      const html = "<p>Hello</p>";
      const result = injectTracking(html, "log-456");
      expect(result).toContain("/api/emails/track/open/log-456.png");
    });
  });

  describe("rewriteLinks", () => {
    it("rewrites http links to tracked URLs", () => {
      const html = '<a href="https://example.com">Click</a>';
      const { html: result, linkMap } = rewriteLinks(html, "log-789");
      expect(result).toContain("/api/emails/track/click/log-789/");
      expect(result).not.toContain("https://example.com");
      expect(Object.values(linkMap)).toContain("https://example.com");
    });

    it("skips mailto: links", () => {
      const html = '<a href="mailto:test@example.com">Email</a>';
      const { html: result } = rewriteLinks(html, "log-1");
      expect(result).toContain("mailto:test@example.com");
    });

    it("skips tel: links", () => {
      const html = '<a href="tel:+1234567890">Call</a>';
      const { html: result } = rewriteLinks(html, "log-1");
      expect(result).toContain("tel:+1234567890");
    });

    it("skips anchor links", () => {
      const html = '<a href="#section">Jump</a>';
      const { html: result } = rewriteLinks(html, "log-1");
      expect(result).toContain("#section");
    });

    it("skips unsubscribe links", () => {
      const html = '<a href="https://appranks.io/unsubscribe/token">Unsubscribe</a>';
      const { html: result } = rewriteLinks(html, "log-1");
      expect(result).toContain("/unsubscribe/token");
    });

    it("builds sequential link map", () => {
      const html = '<a href="https://a.com">A</a> <a href="https://b.com">B</a>';
      const { linkMap } = rewriteLinks(html, "log-1");
      expect(linkMap[0]).toBe("https://a.com");
      expect(linkMap[1]).toBe("https://b.com");
    });
  });

  describe("buildUnsubscribeHeaders", () => {
    it("returns List-Unsubscribe headers", () => {
      const headers = buildUnsubscribeHeaders("token-abc");
      expect(headers["List-Unsubscribe"]).toBeDefined();
      expect(headers["List-Unsubscribe"]).toContain("token-abc");
      expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    });
  });

  describe("buildUnsubscribeUrl", () => {
    it("builds URL with token", () => {
      const url = buildUnsubscribeUrl("token-xyz");
      expect(url).toContain("token-xyz");
      expect(url).toContain("/unsubscribe/");
    });
  });
});
