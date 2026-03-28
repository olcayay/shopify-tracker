"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/skeletons";
import { RotateCcw, ExternalLink } from "lucide-react";
import { buildExternalAppUrl, getPlatformName } from "@/lib/platform-urls";
import type { PlatformId } from "@appranks/shared";
import { ShopifyPreview } from "../../../../[slug]/preview/shopify-preview";
import { SalesforcePreview } from "../../../../[slug]/preview/salesforce-preview";
import { CanvaPreview } from "../../../../[slug]/preview/canva-preview";

const SUPPORTED_PLATFORMS = ["shopify", "salesforce", "canva"];

function PreviewContent({ appData, platform }: { appData: any; platform: string }) {
  const platformPreview =
    platform === "canva"
      ? CanvaPreview({ appData })
      : platform === "salesforce"
        ? SalesforcePreview({ appData })
        : ShopifyPreview({ appData });

  const { preview, editor, resetToOriginal } = platformPreview;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={resetToOriginal}>
          <RotateCcw className="h-4 w-4 mr-1" /> Reset
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4 overflow-auto">
          {preview}
        </div>
        <div className="rounded-lg border bg-card p-4 overflow-auto">
          {editor}
        </div>
      </div>
    </div>
  );
}

export default function V2PreviewPage() {
  const { platform, slug } = useParams<{ platform: string; slug: string }>();
  const { fetchWithAuth } = useAuth();
  const [appData, setAppData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/apps/${encodeURIComponent(slug)}?platform=${platform}`);
      if (res.ok) setAppData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (SUPPORTED_PLATFORMS.includes(platform)) loadData();
    else setLoading(false);
  }, [platform, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-muted-foreground">
          Live preview is not yet available for {getPlatformName(platform as PlatformId)}.
        </p>
        <a
          href={buildExternalAppUrl(platform as PlatformId, slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-primary hover:underline text-sm"
        >
          View on {getPlatformName(platform as PlatformId)} <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  if (loading) return <CardSkeleton />;
  if (!appData) return <p className="text-muted-foreground">Failed to load app data.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Live Preview</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadData}>
            <RotateCcw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <a
            href={buildExternalAppUrl(platform as PlatformId, appData.slug, appData.externalId)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" variant="outline">
              <ExternalLink className="h-4 w-4 mr-1" /> Open on {getPlatformName(platform as PlatformId)}
            </Button>
          </a>
        </div>
      </div>

      <PreviewContent appData={appData} platform={platform} />
    </div>
  );
}
