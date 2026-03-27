import { eq, and } from "drizzle-orm";
import { developerNameToSlug, normalizeDeveloperName } from "@appranks/shared";
import { globalDevelopers, platformDevelopers } from "./schema/developers.js";
import type { Database } from "./index.js";

/**
 * Ensure a platform developer record exists and is linked to a global developer.
 *
 * 1. Check if (platform, name) already exists in platform_developers → done
 * 2. Normalize name → slug, look up in global_developers → link if found
 * 3. No match → create new global developer + platform developer
 *
 * Returns the global developer ID.
 */
export async function ensurePlatformDeveloper(
  db: Database,
  platform: string,
  developerName: string,
  developerWebsite?: string | null
): Promise<number> {
  const trimmedName = developerName.trim();
  if (!trimmedName) return 0;

  // 1. Check existing platform developer
  const [existing] = await db
    .select({ globalDeveloperId: platformDevelopers.globalDeveloperId })
    .from(platformDevelopers)
    .where(
      and(
        eq(platformDevelopers.platform, platform),
        eq(platformDevelopers.name, trimmedName)
      )
    )
    .limit(1);

  if (existing) {
    return existing.globalDeveloperId;
  }

  // 2. Normalize and check global developer by slug
  const slug = developerNameToSlug(trimmedName);
  if (!slug) return 0;

  const displayName = normalizeDeveloperName(trimmedName);

  const [existingGlobal] = await db
    .select({ id: globalDevelopers.id })
    .from(globalDevelopers)
    .where(eq(globalDevelopers.slug, slug))
    .limit(1);

  let globalId: number;

  if (existingGlobal) {
    globalId = existingGlobal.id;

    // Update website if we have one and the existing one is null
    if (developerWebsite) {
      await db
        .update(globalDevelopers)
        .set({ website: developerWebsite, updatedAt: new Date() })
        .where(
          and(
            eq(globalDevelopers.id, globalId),
            eq(globalDevelopers.website, "")
          )
        );
    }
  } else {
    // 3. Create new global developer
    const [newGlobal] = await db
      .insert(globalDevelopers)
      .values({
        slug,
        name: displayName,
        website: developerWebsite || null,
      })
      .onConflictDoNothing()
      .returning({ id: globalDevelopers.id });

    if (newGlobal) {
      globalId = newGlobal.id;
    } else {
      // Race condition: another process created it. Fetch it.
      const [raced] = await db
        .select({ id: globalDevelopers.id })
        .from(globalDevelopers)
        .where(eq(globalDevelopers.slug, slug))
        .limit(1);
      globalId = raced!.id;
    }
  }

  // Create platform developer link
  await db
    .insert(platformDevelopers)
    .values({
      platform,
      name: trimmedName,
      globalDeveloperId: globalId,
    })
    .onConflictDoNothing();

  return globalId;
}
