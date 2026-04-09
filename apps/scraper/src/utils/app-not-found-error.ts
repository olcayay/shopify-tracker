/**
 * Thrown when an app is no longer found on a marketplace.
 * This is NOT a scraping failure — the app has been delisted/removed.
 * The scraper should handle this gracefully (log warning, skip failure count).
 */
export class AppNotFoundError extends Error {
  public readonly slug: string;
  public readonly platform: string;

  constructor(slug: string, platform: string, detail?: string) {
    const msg = detail
      ? `App not found on ${platform} marketplace: ${slug} (${detail})`
      : `App not found on ${platform} marketplace: ${slug}`;
    super(msg);
    this.name = "AppNotFoundError";
    this.slug = slug;
    this.platform = platform;
  }
}
