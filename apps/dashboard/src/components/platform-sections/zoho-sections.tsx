import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Globe, Mail } from "lucide-react";
import type { PlatformSection, PlatformSectionProps } from "./index";

type Props = PlatformSectionProps<"zoho">;

function ZohoAppInfo({ platformData: pd }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>App Info</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {pd?.namespace && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Namespace</p>
              <p className="font-medium">{pd.namespace}</p>
            </div>
          )}
          {pd?.deploymentType && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Deployment Type</p>
              <p className="font-medium">{pd.deploymentType}</p>
            </div>
          )}
          {pd?.cEdition && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Edition</p>
              <p className="font-medium">{pd.cEdition}</p>
            </div>
          )}
          {pd?.pricing && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Pricing</p>
              <p className="font-medium">{pd.pricing}</p>
            </div>
          )}
          {pd?.version && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Version</p>
              <p className="font-medium">{pd.version}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ZohoPartnerDetails({ platformData: pd }: Props) {
  const partners: Array<{ companyName?: string; supportEmail?: string; partner_uuid?: string; websiteUrl?: string }> = pd?.partnerDetails || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Partner Details</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {partners.map((p, i) => (
            <div key={p.partner_uuid || i} className="text-sm space-y-1">
              {p.companyName && (
                <p className="font-medium">{p.companyName}</p>
              )}
              {p.supportEmail && (
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <a href={`mailto:${p.supportEmail}`} className="text-primary hover:underline">{p.supportEmail}</a>
                </p>
              )}
              {p.websiteUrl && (
                <p className="flex items-center gap-1 text-muted-foreground">
                  <Globe className="h-3 w-3" />
                  <a href={p.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{p.websiteUrl}</a>
                </p>
              )}
              {i < partners.length - 1 && <hr className="mt-2" />}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const STAR_LABELS = [
  { key: "fivestar", label: "5" },
  { key: "fourstar", label: "4" },
  { key: "threestar", label: "3" },
  { key: "twostar", label: "2" },
  { key: "onestar", label: "1" },
] as const;

function ZohoRatingBreakdown({ platformData: pd }: Props) {
  const breakdown = pd?.ratingBreakdown as Record<string, number> | null;
  if (!breakdown) return null;

  const total = STAR_LABELS.reduce((sum, { key }) => sum + (breakdown[key] || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rating Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {STAR_LABELS.map(({ key, label }) => {
            const count = breakdown[key] || 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="flex items-center gap-0.5 w-8 justify-end text-muted-foreground">
                  {label} <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                </span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export const zohoSections: PlatformSection[] = [
  {
    id: "zoho-app-info",
    component: ZohoAppInfo,
    shouldRender: ({ platformData: pd }) =>
      !!(pd?.namespace || pd?.deploymentType || pd?.cEdition || pd?.pricing || pd?.version),
  },
  {
    id: "zoho-partner-details",
    component: ZohoPartnerDetails,
    shouldRender: ({ platformData: pd }) =>
      !!(pd?.partnerDetails?.length),
  },
  {
    id: "zoho-rating-breakdown",
    component: ZohoRatingBreakdown,
    shouldRender: ({ platformData: pd }) =>
      !!(pd?.ratingBreakdown),
  },
];
