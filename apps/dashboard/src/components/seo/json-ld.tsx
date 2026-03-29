/**
 * JSON-LD structured data components for SEO.
 * Each component renders a <script type="application/ld+json"> tag.
 */

interface JsonLdProps {
  data: Record<string, unknown>;
}

function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// --- SoftwareApplication (App detail pages) ---

interface AppJsonLdProps {
  name: string;
  description?: string;
  url: string;
  iconUrl?: string | null;
  developer?: string;
  rating?: number | null;
  ratingCount?: number | null;
  pricingHint?: string | null;
  datePublished?: string | null;
  platform?: string;
}

export function AppJsonLd({
  name, description, url, iconUrl, developer,
  rating, ratingCount, pricingHint, datePublished, platform,
}: AppJsonLdProps) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    url,
    applicationCategory: "BusinessApplication",
  };

  if (description) data.description = description;
  if (iconUrl) data.image = iconUrl;
  if (platform) data.operatingSystem = platform;
  if (datePublished) data.datePublished = datePublished;

  if (developer) {
    data.author = { "@type": "Organization", name: developer };
  }

  if (rating != null && ratingCount != null && ratingCount > 0) {
    data.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating,
      ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (pricingHint) {
    data.offers = {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: pricingHint,
    };
  }

  return <JsonLd data={data} />;
}

// --- ItemList (Category pages) ---

interface CategoryJsonLdProps {
  name: string;
  url: string;
  apps: { name: string; url: string; position: number }[];
  totalApps?: number | null;
}

export function CategoryJsonLd({ name, url, apps, totalApps }: CategoryJsonLdProps) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        name,
        url,
        numberOfItems: totalApps ?? apps.length,
        itemListElement: apps.map((app) => ({
          "@type": "ListItem",
          position: app.position,
          item: {
            "@type": "SoftwareApplication",
            name: app.name,
            url: app.url,
          },
        })),
      }}
    />
  );
}

// --- BreadcrumbList ---

interface BreadcrumbJsonLdProps {
  items: { name: string; url: string }[];
}

export function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          item: item.url,
        })),
      }}
    />
  );
}

// --- FAQPage ---

interface FaqJsonLdProps {
  questions: { question: string; answer: string }[];
}

export function FaqJsonLd({ questions }: FaqJsonLdProps) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: questions.map((q) => ({
          "@type": "Question",
          name: q.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: q.answer,
          },
        })),
      }}
    />
  );
}

// --- Organization (site-wide) ---

interface OrganizationJsonLdProps {
  name?: string;
  url?: string;
  logoUrl?: string;
}

export function OrganizationJsonLd({
  name = "AppRanks",
  url = "https://appranks.io",
  logoUrl = "https://appranks.io/favicon.ico",
}: OrganizationJsonLdProps) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name,
        url,
        logo: logoUrl,
      }}
    />
  );
}

// --- Article (Comparison pages) ---

interface ComparisonJsonLdProps {
  headline: string;
  url: string;
  apps: { name: string; url: string }[];
  datePublished?: string;
}

export function ComparisonJsonLd({ headline, url, apps, datePublished }: ComparisonJsonLdProps) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Article",
        headline,
        url,
        articleSection: "App Comparison",
        datePublished: datePublished || new Date().toISOString().slice(0, 10),
        about: apps.map((app) => ({
          "@type": "SoftwareApplication",
          name: app.name,
          url: app.url,
        })),
      }}
    />
  );
}
