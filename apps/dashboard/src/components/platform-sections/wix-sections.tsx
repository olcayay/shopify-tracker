import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Folder, DollarSign, Star, Mail } from "lucide-react";
import type { PlatformSection, PlatformSectionProps } from "./index";

type Props = PlatformSectionProps<"wix">;

function WixCollections({ platformData: pd }: Props) {
  const collections: Array<{ slug: string; name: string }> = pd?.collections || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Folder className="h-4 w-4" /> Collections
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {collections.map((c) => (
            <Badge key={c.slug} variant="secondary" className="text-xs">
              {c.name}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WixPricingDetails({ platformData: pd }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> Pricing Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {pd?.currency && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Currency</p>
              <p className="font-medium">{pd.currency}</p>
            </div>
          )}
          {pd?.trialDays != null && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Trial Days</p>
              <p className="font-medium">{pd.trialDays}</p>
            </div>
          )}
          {pd?.isFreeApp != null && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Free App</p>
              <p className="font-medium">{pd.isFreeApp ? "Yes" : "No"}</p>
            </div>
          )}
          {pd?.isAvailableWorldwide != null && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Available Worldwide</p>
              <p className="font-medium">{pd.isAvailableWorldwide ? "Yes" : "No"}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function WixRatingHistogram({ platformData: pd }: Props) {
  const h = pd?.ratingHistogram as { rating5: number; rating4: number; rating3: number; rating2: number; rating1: number } | null;
  if (!h) return null;

  const total = h.rating5 + h.rating4 + h.rating3 + h.rating2 + h.rating1;
  const maxCount = Math.max(h.rating5, h.rating4, h.rating3, h.rating2, h.rating1, 1);
  const bars = [
    { label: "5", count: h.rating5 },
    { label: "4", count: h.rating4 },
    { label: "3", count: h.rating3 },
    { label: "2", count: h.rating2 },
    { label: "1", count: h.rating1 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-4 w-4" /> Rating Histogram
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {bars.map((bar) => (
            <div key={bar.label} className="flex items-center gap-2">
              <span className="w-4 text-right text-muted-foreground">{bar.label}</span>
              <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                <div
                  className="h-full bg-primary rounded"
                  style={{ width: `${(bar.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-10 text-right text-muted-foreground text-xs">
                {bar.count} ({total > 0 ? Math.round((bar.count / total) * 100) : 0}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WixDeveloperInfo({ platformData: pd }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-4 w-4" /> Developer Info
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 text-sm">
          {pd?.developerEmail && (
            <p>
              <span className="text-muted-foreground">Email:</span>{" "}
              <a href={`mailto:${pd.developerEmail}`} className="text-primary hover:underline">{pd.developerEmail}</a>
            </p>
          )}
          {pd?.developerPrivacyUrl && (
            <p>
              <span className="text-muted-foreground">Privacy Policy:</span>{" "}
              <a href={pd.developerPrivacyUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{pd.developerPrivacyUrl}</a>
            </p>
          )}
          {pd?.demoUrl && (
            <p>
              <span className="text-muted-foreground">Demo:</span>{" "}
              <a href={pd.demoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{pd.demoUrl}</a>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const wixSections: PlatformSection[] = [
  {
    id: "wix-collections",
    component: WixCollections,
    shouldRender: ({ platformData: pd }) => !!(pd?.collections?.length),
  },
  {
    id: "wix-pricing-details",
    component: WixPricingDetails,
    shouldRender: ({ platformData: pd }) =>
      !!(pd?.currency || pd?.trialDays != null || pd?.isFreeApp != null || pd?.isAvailableWorldwide != null),
  },
  {
    id: "wix-rating-histogram",
    component: WixRatingHistogram,
    shouldRender: ({ platformData: pd }) => !!pd?.ratingHistogram,
  },
  {
    id: "wix-developer-info",
    component: WixDeveloperInfo,
    shouldRender: ({ platformData: pd }) =>
      !!(pd?.developerEmail || pd?.developerPrivacyUrl || pd?.demoUrl),
  },
];
