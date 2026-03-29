/**
 * Email tracking utilities: open pixel injection, click link rewriting, unsubscribe tokens.
 */
import { randomBytes } from "crypto";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.appranks.io";

/** Generate a random unsubscribe token */
export function generateUnsubscribeToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Inject open-tracking pixel and unsubscribe footer into email HTML.
 * Call this AFTER rendering the email template.
 */
export function injectTracking(
  html: string,
  emailLogId: string,
  unsubscribeToken?: string
): string {
  let result = html;

  // Inject 1x1 tracking pixel before </body>
  const pixelUrl = `${API_BASE_URL}/api/emails/track/open/${emailLogId}.png`;
  const pixel = `<img src="${pixelUrl}" width="1" height="1" style="display:none;border:0;" alt="" />`;

  if (result.includes("</body>")) {
    result = result.replace("</body>", `${pixel}</body>`);
  } else {
    result += pixel;
  }

  return result;
}

/**
 * Rewrite links in HTML for click tracking.
 * Each <a href="..."> gets a tracked redirect URL.
 * Returns the modified HTML and a map of link index → original URL.
 */
export function rewriteLinks(
  html: string,
  emailLogId: string
): { html: string; linkMap: Record<number, string> } {
  const linkMap: Record<number, string> = {};
  let linkIndex = 0;

  const result = html.replace(
    /<a\s+([^>]*?)href="([^"]+)"([^>]*?)>/gi,
    (match, before, href, after) => {
      // Skip unsubscribe links, mailto:, tel:, and anchor links
      if (
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("#") ||
        href.includes("/unsubscribe/") ||
        href.includes("/track/")
      ) {
        return match;
      }

      const idx = linkIndex++;
      linkMap[idx] = href;
      const trackedUrl = `${API_BASE_URL}/api/emails/track/click/${emailLogId}/${idx}`;
      return `<a ${before}href="${trackedUrl}"${after}>`;
    }
  );

  return { html: result, linkMap };
}

/**
 * Build List-Unsubscribe headers for RFC 8058 compliance.
 */
export function buildUnsubscribeHeaders(unsubscribeToken: string): Record<string, string> {
  const unsubUrl = `${API_BASE_URL}/api/emails/unsubscribe/${unsubscribeToken}`;
  return {
    "List-Unsubscribe": `<${unsubUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * Build the full unsubscribe URL for use in email footer.
 */
export function buildUnsubscribeUrl(token: string): string {
  return `${API_BASE_URL}/api/emails/unsubscribe/${token}`;
}
