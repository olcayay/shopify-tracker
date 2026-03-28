import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppWindow, ExternalLink } from "lucide-react";
import type { PlatformSection, PlatformSectionProps } from "./index";

type Props = PlatformSectionProps<"shopify">;

function ShopifySimilarApps({ platformData: pd }: Props) {
  const similarApps = pd?.similarApps || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Similar Apps</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {similarApps.map((app) => (
            <a
              key={app.slug}
              href={`https://apps.shopify.com/${app.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Badge variant="secondary" className="text-xs gap-1 cursor-pointer hover:bg-muted">
                <AppWindow className="h-3 w-3" /> {app.name}
              </Badge>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ShopifyDemoStore({ platformData: pd }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Demo Store</CardTitle>
      </CardHeader>
      <CardContent>
        <a
          href={pd?.demoStoreUrl ?? ""}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline text-sm inline-flex items-center gap-1"
        >
          <ExternalLink className="h-3 w-3" /> {pd?.demoStoreUrl}
        </a>
      </CardContent>
    </Card>
  );
}

export const shopifySections: PlatformSection[] = [
  {
    id: "shopify-similar-apps",
    component: ShopifySimilarApps,
    shouldRender: ({ platformData: pd }) => !!(pd?.similarApps?.length),
  },
  {
    id: "shopify-demo-store",
    component: ShopifyDemoStore,
    shouldRender: ({ platformData: pd }) => !!pd?.demoStoreUrl,
  },
];
