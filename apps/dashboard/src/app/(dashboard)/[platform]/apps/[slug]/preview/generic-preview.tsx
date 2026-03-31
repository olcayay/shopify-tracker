/**
 * Generic app listing preview for platforms without a custom preview component.
 * Works for: WordPress, Atlassian, Zoom, Zoho, Zendesk, HubSpot
 */
import Image from "next/image";
import { Star, Globe, Tag, Calendar, Download, CheckCircle2 } from "lucide-react";
import { formatNumber, formatMonthYear } from "@/lib/format-utils";

interface GenericPreviewProps {
  app: any;
  platformName: string;
}

export function GenericPreview({ app, platformName }: GenericPreviewProps) {
  const snap = app.latestSnapshot || {};
  const developer = snap.developer || {};
  const features = snap.features || [];
  const categories = snap.categories || [];
  const pricingPlans = snap.pricingPlans || [];

  return (
    <div className="max-w-3xl mx-auto bg-white rounded-lg border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-start gap-4">
          {app.iconUrl ? (
            <Image
              src={app.iconUrl}
              alt={app.name}
              width={80}
              height={80}
              className="rounded-xl shadow-sm"
              unoptimized
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground">
              {app.name?.charAt(0) || "?"}
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{app.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              By {developer.name || "Unknown Developer"}
              {developer.website && (
                <> · <Globe className="inline h-3 w-3" /> {developer.website.replace(/^https?:\/\//, "")}</>
              )}
            </p>
            <div className="flex items-center gap-4 mt-2 text-sm">
              {app.averageRating != null && (
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">{Number(app.averageRating).toFixed(1)}</span>
                  {app.ratingCount != null && (
                    <span className="text-muted-foreground">({app.ratingCount} reviews)</span>
                  )}
                </span>
              )}
              {app.pricingHint && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Tag className="h-3.5 w-3.5" /> {app.pricingHint}
                </span>
              )}
              {app.activeInstalls != null && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Download className="h-3.5 w-3.5" /> {formatNumber(app.activeInstalls)} installs
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {(snap.appIntroduction || snap.intro) && (
        <div className="p-6 border-b">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</h2>
          <p className="text-sm leading-relaxed">{snap.appIntroduction || snap.intro}</p>
        </div>
      )}

      {/* Features */}
      {features.length > 0 && (
        <div className="p-6 border-b">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Features</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {features.slice(0, 10).map((f: any, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{typeof f === "string" ? f : f?.title || f?.name || ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pricing */}
      {pricingPlans.length > 0 && (
        <div className="p-6 border-b">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pricing</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pricingPlans.map((plan: any, i: number) => (
              <div key={i} className="rounded-lg border p-3">
                <p className="font-semibold">{plan.name || `Plan ${i + 1}`}</p>
                {plan.price && <p className="text-primary font-bold mt-1">{plan.price}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <div className="p-6 border-b">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Categories</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((c: any, i: number) => (
              <span key={i} className="text-xs bg-muted px-2 py-1 rounded-full">
                {c.title || c.slug || c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 bg-slate-50 text-center text-xs text-muted-foreground">
        Preview of how this app appears on {platformName}
        {app.launchedDate && (
          <> · Launched {formatMonthYear(app.launchedDate)}</>
        )}
      </div>
    </div>
  );
}
