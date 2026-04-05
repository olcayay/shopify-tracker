import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Tag, Store } from "lucide-react";
import type { PlatformSection, PlatformSectionProps } from "./index";

type Props = PlatformSectionProps<"woocommerce">;

function WooCommerceAppInfo({ platformData: pd }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Extension Info</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {pd?.vendorName && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Vendor</p>
              <p className="font-medium flex items-center gap-1">
                <Store className="h-3 w-3" />
                {pd.vendorUrl ? (
                  <a href={pd.vendorUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {pd.vendorName}
                  </a>
                ) : (
                  pd.vendorName
                )}
              </p>
            </div>
          )}
          {pd?.type && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Type</p>
              <p className="font-medium capitalize">{pd.type}</p>
            </div>
          )}
          {pd?.pricing && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Price</p>
              <p className="font-medium flex items-center gap-0.5">
                <DollarSign className="h-3 w-3" />
                {pd.pricing}
              </p>
            </div>
          )}
          {pd?.billingPeriod && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Billing Period</p>
              <p className="font-medium capitalize">{pd.billingPeriod}</p>
            </div>
          )}
        </div>
        {(pd?.isOnSale || pd?.freemiumType === "freemium") && (
          <div className="flex flex-wrap gap-2 mt-4">
            {pd?.isOnSale && (
              <Badge variant="default" className="text-xs gap-1">
                <Tag className="h-3 w-3" /> On Sale
              </Badge>
            )}
            {pd?.freemiumType === "freemium" && (
              <Badge variant="secondary" className="text-xs">
                Freemium
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export const woocommerceSections: PlatformSection[] = [
  {
    id: "woocommerce-app-info",
    component: WooCommerceAppInfo,
    shouldRender: ({ platformData: pd }) =>
      !!(pd?.vendorName || pd?.type || pd?.pricing || pd?.isOnSale),
  },
];
