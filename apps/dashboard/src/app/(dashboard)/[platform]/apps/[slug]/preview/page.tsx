"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/skeletons";
import { RotateCcw, X as XIcon, ExternalLink } from "lucide-react";
import { buildExternalAppUrl, getPlatformName } from "@/lib/platform-urls";
import type { PlatformId } from "@appranks/shared";
import { ShopifyPreview } from "./shopify-preview";
import { SalesforcePreview } from "./salesforce-preview";
import { CanvaPreview } from "./canva-preview";

export default function PreviewPage() {
  const params = useParams<{ platform: string; slug: string }>();
  const { platform, slug } = params;
  const router = useRouter();
  const { fetchWithAuth } = useAuth();

  const [appData, setAppData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (platform !== "shopify" && platform !== "salesforce" && platform !== "canva" && platform !== "wix") return;
    async function loadData() {
      setLoading(true);
      const res = await fetchWithAuth(
        `/api/apps/${encodeURIComponent(slug)}`
      );
      if (res.ok) {
        const data = await res.json();
        setAppData(data);
      }
      setLoading(false);
    }
    loadData();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [slug, platform]); // eslint-disable-line react-hooks/exhaustive-deps

  if (platform !== "shopify" && platform !== "salesforce" && platform !== "canva" && platform !== "wix") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h2 className="text-xl font-semibold">Preview not available</h2>
        <p className="text-muted-foreground text-center max-w-md">
          The listing preview is not available for this platform.
        </p>
        <a
          href={buildExternalAppUrl(platform as PlatformId, slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-primary hover:underline"
        >
          View on {getPlatformName(platform as PlatformId)}
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <CardSkeleton lines={3} />
        <CardSkeleton lines={5} />
      </div>
    );
  }

  if (!appData) {
    return <p className="text-muted-foreground">App not found.</p>;
  }

  function closePreview() {
    router.push(`/${platform}/apps/${slug}`);
  }

  return (
    <PreviewShell
      appData={appData}
      platform={platform}
      onClose={closePreview}
    />
  );
}

function PreviewShell({
  appData,
  platform,
  onClose,
}: {
  appData: any;
  platform: string;
  onClose: () => void;
}) {
  const platformPreview =
    platform === "canva"
      ? CanvaPreview({ appData })
      : platform === "salesforce"
        ? SalesforcePreview({ appData })
        : ShopifyPreview({ appData });

  const { preview, editor, resetToOriginal } = platformPreview;
  const icon = appData.iconUrl;
  const platformLabel =
    platform === "wix"
      ? "Wix App Market Preview"
      : platform === "canva"
        ? "Canva Apps Preview"
        : platform === "salesforce"
          ? "AppExchange Preview"
          : "App Store Preview";

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header bar */}
      <div className="shrink-0 border-b px-4 py-2.5 flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          {icon && <img src={icon} alt="" className="h-6 w-6 rounded" />}
          <h2 className="font-semibold text-sm">{appData.name}</h2>
          <span className="text-xs text-muted-foreground">{platformLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetToOriginal}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reset
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main content: Preview left, Editor right */}
      <div className="flex-1 flex min-h-0">
        {/* Left — Preview (scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 min-w-0">
          {preview}
        </div>

        {/* Right — Editor (scrollable) */}
        <div className="w-[400px] shrink-0 border-l overflow-y-auto p-5 bg-background">
          {editor}
        </div>
      </div>
    </div>
  );
}
