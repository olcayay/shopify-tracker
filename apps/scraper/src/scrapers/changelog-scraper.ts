/**
 * Changelog and version history scraper (PLA-331).
 *
 * Extracts version history from platform-specific app detail pages.
 * Stores changelog entries alongside app snapshots.
 */
import * as cheerio from "cheerio";
import { sql } from "drizzle-orm";
import type { Database } from "@appranks/db";
import { createLogger, type PlatformId } from "@appranks/shared";

const log = createLogger("changelog-scraper");

export interface ChangelogEntry {
  version: string;
  date: string | null;
  changes: string[];
  raw?: string;
}

/**
 * Extract changelog entries from Shopify app page HTML.
 * Shopify shows "What's new" section with version history.
 */
export function parseShopifyChangelog(html: string): ChangelogEntry[] {
  const $ = cheerio.load(html);
  const entries: ChangelogEntry[] = [];

  // Look for version history sections
  $("h3, h4").each((_, el) => {
    const text = $(el).text().trim();
    const versionMatch = text.match(/^v?(\d+\.\d+(?:\.\d+)?)/i);
    if (versionMatch) {
      const version = versionMatch[1];
      const dateEl = $(el).next("p, span, time");
      const date = dateEl.text().trim() || null;

      const changes: string[] = [];
      const list = $(el).nextAll("ul").first();
      list.find("li").each((_, li) => {
        const change = $(li).text().trim();
        if (change) changes.push(change);
      });

      if (changes.length > 0 || date) {
        entries.push({ version, date, changes });
      }
    }
  });

  return entries;
}

/**
 * Extract changelog from WordPress plugin API response.
 * WordPress provides a "changelog" section in the plugin API.
 */
export function parseWordPressChangelog(changelogHtml: string): ChangelogEntry[] {
  if (!changelogHtml) return [];
  const $ = cheerio.load(changelogHtml);
  const entries: ChangelogEntry[] = [];

  $("h4, h3").each((_, el) => {
    const heading = $(el).text().trim();
    const versionMatch = heading.match(/(\d+\.\d+(?:\.\d+)?)/);
    if (versionMatch) {
      const changes: string[] = [];
      const list = $(el).next("ul");
      list.find("li").each((_, li) => {
        changes.push($(li).text().trim());
      });
      entries.push({
        version: versionMatch[1],
        date: null,
        changes,
      });
    }
  });

  return entries;
}

/**
 * Store changelog data in the app's platformData.
 */
export async function storeChangelog(
  db: Database,
  appId: number,
  platform: PlatformId,
  changelog: ChangelogEntry[]
): Promise<void> {
  if (changelog.length === 0) return;

  try {
    // Update the latest snapshot's platformData with changelog
    await db.execute(sql`
      UPDATE app_snapshots
      SET platform_data = platform_data || ${JSON.stringify({ changelog })}::jsonb
      WHERE id = (
        SELECT id FROM app_snapshots
        WHERE app_id = ${appId}
        ORDER BY scraped_at DESC
        LIMIT 1
      )
    `);
    log.info("changelog stored", { appId, platform, entries: changelog.length });
  } catch (err) {
    log.warn("failed to store changelog", { appId, error: String(err) });
  }
}
