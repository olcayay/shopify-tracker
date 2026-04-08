import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicAudit } from "@/lib/api";
import { AuditReport } from "@/components/audit/audit-report";
import { PLATFORMS } from "@appranks/shared";

interface PageProps {
  params: Promise<{ platform: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { platform, slug } = await params;
  try {
    const report = await getPublicAudit(platform, slug);
    if (!report) return { title: "Audit Not Found | AppRanks" };

    const title = `${report.app.name} Listing Audit — ${report.overallScore}/100 | AppRanks`;
    const description = `See how ${report.app.name} scores across title, description, visuals, categories, and more.`;

    return {
      title,
      description,
      openGraph: { title, description, type: "website" },
      alternates: { canonical: `/audit/${platform}/${slug}` },
    };
  } catch {
    return { title: "Audit | AppRanks" };
  }
}

export default async function AuditReportPage({ params }: PageProps) {
  const { platform, slug } = await params;

  const platformConfig = PLATFORMS.find((p) => p.id === platform);
  if (!platformConfig) notFound();

  let report;
  try {
    report = await getPublicAudit(platform, slug);
  } catch {
    notFound();
  }
  if (!report) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${report.app.name} Listing Audit`,
    description: `See how ${report.app.name} scores across title, description, visuals, categories, and more.`,
    url: `https://appranks.io/audit/${platform}/${slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <AuditReport report={report} platform={platform} />
      </div>
    </>
  );
}
