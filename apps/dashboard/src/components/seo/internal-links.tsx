import Link from "next/link";
import { PLATFORMS, type PlatformId } from "@appranks/shared";

/**
 * Cross-link section for public pages — promotes internal linking for SEO.
 */

interface RelatedLink {
  href: string;
  label: string;
}

export function PlatformCrossLinks({ currentPlatform }: { currentPlatform: string }) {
  const others = Object.entries(PLATFORMS).filter(([id]) => id !== currentPlatform);

  return (
    <section className="mt-12 pt-8 border-t">
      <h2 className="text-sm font-semibold text-muted-foreground mb-3">Explore Other Platforms</h2>
      <div className="flex flex-wrap gap-2">
        {others.map(([id, config]) => (
          <Link
            key={id}
            href={`/trends/${id}`}
            className="text-xs px-2.5 py-1 rounded-full border hover:bg-muted transition-colors"
          >
            {config.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function RelatedAppsLinks({
  platform,
  apps,
}: {
  platform: string;
  apps: { slug: string; name: string }[];
}) {
  if (apps.length === 0) return null;

  return (
    <section className="mt-8 pt-6 border-t">
      <h2 className="text-sm font-semibold text-muted-foreground mb-3">Related Apps</h2>
      <div className="flex flex-wrap gap-2">
        {apps.slice(0, 10).map((app) => (
          <Link
            key={app.slug}
            href={`/apps/${platform}/${app.slug}`}
            className="text-xs px-2.5 py-1 rounded-full border hover:bg-muted transition-colors"
          >
            {app.name}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function CategoryLinks({
  platform,
  categories,
}: {
  platform: string;
  categories: { slug: string; title: string }[];
}) {
  if (categories.length === 0) return null;

  return (
    <section className="mt-8 pt-6 border-t">
      <h2 className="text-sm font-semibold text-muted-foreground mb-3">Related Categories</h2>
      <div className="flex flex-wrap gap-2">
        {categories.slice(0, 12).map((cat) => (
          <Link
            key={cat.slug}
            href={`/categories/${platform}/${cat.slug}`}
            className="text-xs px-2.5 py-1 rounded-full border hover:bg-muted transition-colors"
          >
            {cat.title}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ComparisonLinks({
  platform,
  appSlug,
  similarApps,
}: {
  platform: string;
  appSlug: string;
  similarApps: { slug: string; name: string }[];
}) {
  if (similarApps.length === 0) return null;

  return (
    <section className="mt-8 pt-6 border-t">
      <h2 className="text-sm font-semibold text-muted-foreground mb-3">Compare</h2>
      <div className="flex flex-wrap gap-2">
        {similarApps.slice(0, 5).map((sa) => (
          <Link
            key={sa.slug}
            href={`/compare/${platform}/${appSlug}-vs-${sa.slug}`}
            className="text-xs px-2.5 py-1 rounded-full border hover:bg-muted transition-colors"
          >
            vs {sa.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
