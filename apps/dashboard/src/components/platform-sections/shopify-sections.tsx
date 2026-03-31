import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppWindow } from "lucide-react";
import { ExternalLink } from "@/components/ui/external-link";
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
            <ExternalLink
              key={app.slug}
              href={`https://apps.shopify.com/${app.slug}`}
              showIcon={false}
              className="hover:no-underline"
            >
              <Badge variant="secondary" className="text-xs gap-1 cursor-pointer hover:bg-muted">
                <AppWindow className="h-3 w-3" /> {app.name}
              </Badge>
            </ExternalLink>
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
        <ExternalLink href={pd?.demoStoreUrl ?? ""} iconSize="sm" className="text-primary text-sm">
          {pd?.demoStoreUrl}
        </ExternalLink>
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
