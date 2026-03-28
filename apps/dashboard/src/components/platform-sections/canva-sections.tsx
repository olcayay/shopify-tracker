import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Tag, User, ExternalLink } from "lucide-react";
import type { PlatformSection, PlatformSectionProps } from "./index";

type Props = PlatformSectionProps<"canva">;

function CanvaPermissions({ platformData: pd }: Props) {
  const permissions = pd?.permissions || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" /> Permissions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {permissions.map((p, i) => (
            <Badge key={i} variant={p.type === "MANDATORY" ? "default" : "secondary"} className="text-xs">
              {p.scope} <span className="ml-1 opacity-70">({p.type.toLowerCase()})</span>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CanvaTopics({ platformData: pd }: Props) {
  const topics: string[] = pd?.topics || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-4 w-4" /> Topics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {topics.map((t, i) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {t.replace(/^marketplace_topic\./, "")}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CanvaDeveloperInfo({ platformData: pd }: Props) {
  const addr = pd?.developerAddress as { street?: string; city?: string; country?: string; state?: string; zip?: string } | null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-4 w-4" /> Developer Info
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
          {pd?.developerPhone && (
            <p>
              <span className="text-muted-foreground">Phone:</span>{" "}
              <span className="font-medium">{pd.developerPhone}</span>
            </p>
          )}
          {addr && (
            <p>
              <span className="text-muted-foreground">Address:</span>{" "}
              <span className="font-medium">
                {[addr.street, addr.city, addr.state, addr.zip, addr.country].filter(Boolean).join(", ")}
              </span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CanvaLinks({ platformData: pd }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-4 w-4" /> Links
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 text-sm">
          {pd?.termsUrl && (
            <p>
              <span className="text-muted-foreground">Terms of Service:</span>{" "}
              <a href={pd.termsUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{pd.termsUrl}</a>
            </p>
          )}
          {pd?.privacyUrl && (
            <p>
              <span className="text-muted-foreground">Privacy Policy:</span>{" "}
              <a href={pd.privacyUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{pd.privacyUrl}</a>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const canvaSections: PlatformSection[] = [
  {
    id: "canva-permissions",
    component: CanvaPermissions,
    shouldRender: ({ platformData: pd }) => !!(pd?.permissions?.length),
  },
  {
    id: "canva-topics",
    component: CanvaTopics,
    shouldRender: ({ platformData: pd }) => !!(pd?.topics?.length),
  },
  {
    id: "canva-developer-info",
    component: CanvaDeveloperInfo,
    shouldRender: ({ platformData: pd }) => {
      const addr = pd?.developerAddress;
      return !!(pd?.developerEmail || pd?.developerPhone || addr);
    },
  },
  {
    id: "canva-links",
    component: CanvaLinks,
    shouldRender: ({ platformData: pd }) => !!(pd?.termsUrl || pd?.privacyUrl),
  },
];
