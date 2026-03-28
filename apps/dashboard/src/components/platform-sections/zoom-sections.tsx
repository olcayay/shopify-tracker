import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Blocks, Shield, Star } from "lucide-react";
import type { PlatformSection, PlatformSectionProps } from "./index";

type Props = PlatformSectionProps<"zoom">;

function ZoomAppInfo({ platformData: pd }: Props) {
  const worksWith = pd?.worksWith || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>App Info</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {pd?.companyName && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Company</p>
              <p className="font-medium">{pd.companyName}</p>
            </div>
          )}
          {pd?.usage && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Usage</p>
              <p className="font-medium">{pd.usage}</p>
            </div>
          )}
          {worksWith.length > 0 && (
            <div className="col-span-2">
              <p className="text-muted-foreground text-xs mb-1">Works With</p>
              <div className="flex flex-wrap gap-1">
                {worksWith.map((item, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ZoomTrustSignals({ platformData: pd }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Trust Signals</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {pd?.fedRampAuthorized && (
            <Badge variant="default" className="text-xs gap-1">
              <Shield className="h-3 w-3" /> FedRAMP Authorized
            </Badge>
          )}
          {pd?.essentialApp && (
            <Badge variant="default" className="text-xs gap-1">
              <Star className="h-3 w-3" /> Essential App
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const zoomSections: PlatformSection[] = [
  {
    id: "zoom-app-info",
    component: ZoomAppInfo,
    shouldRender: ({ platformData: pd }) =>
      !!(pd?.companyName || pd?.worksWith?.length || (pd?.usage && Object.keys(pd.usage).length > 0)),
  },
  {
    id: "zoom-trust-signals",
    component: ZoomTrustSignals,
    shouldRender: ({ platformData: pd }) =>
      !!(pd?.fedRampAuthorized || pd?.essentialApp),
  },
];
