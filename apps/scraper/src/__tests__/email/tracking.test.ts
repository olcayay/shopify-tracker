import { describe, it, expect } from "vitest";
import {
  generateUnsubscribeToken,
  injectTracking,
  rewriteLinks,
  buildUnsubscribeHeaders,
  buildUnsubscribeUrl,
} from "../../email/tracking.js";

describe("generateUnsubscribeToken", () => {
  it("generates a 64-character hex string", () => {
    const token = generateUnsubscribeToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("generates unique tokens", () => {
    const token1 = generateUnsubscribeToken();
    const token2 = generateUnsubscribeToken();
    expect(token1).not.toBe(token2);
  });
});

describe("injectTracking", () => {
  it("inserts tracking pixel before </body>", () => {
    const html = "<html><body><p>Hello</p></body></html>";
    const result = injectTracking(html, "log-123");
    expect(result).toContain('src="');
    expect(result).toContain("/api/emails/track/open/log-123.png");
    expect(result).toContain('width="1"');
    expect(result).toContain('height="1"');
    expect(result.indexOf("track/open")).toBeLessThan(result.indexOf("</body>"));
  });

  it("appends pixel when no </body> tag", () => {
    const html = "<p>Simple email</p>";
    const result = injectTracking(html, "log-456");
    expect(result).toContain("/api/emails/track/open/log-456.png");
  });
});

describe("rewriteLinks", () => {
  it("rewrites regular links with tracking URLs", () => {
    const html = '<a href="https://example.com">Click here</a>';
    const { html: result, linkMap } = rewriteLinks(html, "log-789");
    expect(result).toContain("/api/emails/track/click/log-789/0");
    expect(result).not.toContain("https://example.com");
    expect(linkMap[0]).toBe("https://example.com");
  });

  it("assigns sequential link indices", () => {
    const html = '<a href="https://a.com">A</a> <a href="https://b.com">B</a>';
    const { linkMap } = rewriteLinks(html, "log-1");
    expect(linkMap[0]).toBe("https://a.com");
    expect(linkMap[1]).toBe("https://b.com");
  });

  it("skips mailto links", () => {
    const html = '<a href="mailto:test@example.com">Email</a>';
    const { html: result } = rewriteLinks(html, "log-1");
    expect(result).toContain("mailto:test@example.com");
    expect(result).not.toContain("/track/click/");
  });

  it("skips unsubscribe links", () => {
    const html = '<a href="https://api.appranks.io/api/emails/unsubscribe/abc123">Unsubscribe</a>';
    const { html: result } = rewriteLinks(html, "log-1");
    expect(result).toContain("/unsubscribe/abc123");
    expect(result).not.toContain("/track/click/");
  });

  it("skips anchor links", () => {
    const html = '<a href="#section">Jump</a>';
    const { html: result } = rewriteLinks(html, "log-1");
    expect(result).toContain('href="#section"');
  });

  it("preserves other attributes on links", () => {
    const html = '<a class="btn" href="https://example.com" target="_blank">Click</a>';
    const { html: result } = rewriteLinks(html, "log-1");
    expect(result).toContain('class="btn"');
    expect(result).toContain('target="_blank"');
  });
});

describe("buildUnsubscribeHeaders", () => {
  it("returns List-Unsubscribe and List-Unsubscribe-Post headers", () => {
    const headers = buildUnsubscribeHeaders("test-token-123");
    expect(headers["List-Unsubscribe"]).toContain("/api/emails/unsubscribe/test-token-123");
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

describe("buildUnsubscribeUrl", () => {
  it("builds correct URL", () => {
    const url = buildUnsubscribeUrl("abc-token");
    expect(url).toContain("/api/emails/unsubscribe/abc-token");
  });
});
