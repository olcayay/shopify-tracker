import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Info } from "lucide-react";
import type { PlatformSection, PlatformSectionProps } from "./index";

type Props = PlatformSectionProps<"zendesk">;

function ZendeskProducts({ platformData: pd }: Props) {
  const products: Array<{ name?: string; label?: string }> = pd?.products || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Products</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {products.map((p, i) => (
            <Badge key={i} variant="secondary" className="text-xs gap-1">
              <Package className="h-3 w-3" /> {p.label || p.name}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ZendeskAppInfo({ platformData: pd }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>App Info</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {pd?.version && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Version</p>
              <p className="font-medium">{pd.version}</p>
            </div>
          )}
          {pd?.pricing && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Pricing</p>
              <p className="font-medium">{pd.pricing}</p>
            </div>
          )}
          {pd?.datePublished && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Date Published</p>
              <p className="font-medium">
                {new Date(pd.datePublished).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </div>
          )}
          {pd?.source && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Source</p>
              <p className="font-medium">{pd.source}</p>
            </div>
          )}
          {pd?.installationInstructions && (
            <div className="col-span-2">
              <p className="text-muted-foreground text-xs mb-1">Installation Instructions</p>
              <p className="font-medium whitespace-pre-line">{pd.installationInstructions}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const zendeskSections: PlatformSection[] = [
  {
    id: "zendesk-products",
    component: ZendeskProducts,
    shouldRender: ({ platformData: pd }) => !!(pd?.products?.length),
  },
  {
    id: "zendesk-app-info",
    component: ZendeskAppInfo,
    shouldRender: ({ platformData: pd }) =>
      !!(pd?.version || pd?.pricing || pd?.installationInstructions || pd?.datePublished || pd?.source),
  },
];
