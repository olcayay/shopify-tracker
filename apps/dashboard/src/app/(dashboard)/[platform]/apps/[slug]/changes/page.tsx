import { formatDateOnly } from "@/lib/format-date";
import { getAppChanges } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ChangesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let changes: any[] = [];
  try {
    changes = await getAppChanges(slug, 50);
  } catch {
    changes = [];
  }

  if (changes.length === 0) {
    return (
      <p className="text-muted-foreground">No listing changes detected yet.</p>
    );
  }

  const fieldLabels: Record<string, string> = {
    name: "App Name",
    appIntroduction: "App Introduction",
    appDetails: "App Details",
    features: "Features",
    seoTitle: "SEO Title",
    seoMetaDescription: "SEO Meta Description",
    appCardSubtitle: "App Card Subtitle",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Listing Changes ({changes.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {changes.map((change: any) => {
            const isFeatures = change.field === "features";
            let addedFeatures: string[] = [];
            let removedFeatures: string[] = [];
            if (isFeatures) {
              try {
                const oldArr: string[] = JSON.parse(change.oldValue || "[]");
                const newArr: string[] = JSON.parse(change.newValue || "[]");
                addedFeatures = newArr.filter((f) => !oldArr.includes(f));
                removedFeatures = oldArr.filter((f) => !newArr.includes(f));
              } catch { /* ignore parse errors */ }
            }

            return (
              <div
                key={change.id}
                className="border-b pb-4 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    {fieldLabels[change.field] || change.field}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDateOnly(change.detectedAt)}
                  </span>
                </div>
                {isFeatures ? (
                  <div className="space-y-1 text-sm">
                    {removedFeatures.map((f, i) => (
                      <p key={`r-${i}`} className="text-red-500 line-through">
                        - {f}
                      </p>
                    ))}
                    {addedFeatures.map((f, i) => (
                      <p key={`a-${i}`} className="text-green-600">
                        + {f}
                      </p>
                    ))}
                    {addedFeatures.length === 0 && removedFeatures.length === 0 && (
                      <p className="text-muted-foreground italic">Order changed</p>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Before</p>
                      <p className="text-red-500/80 line-clamp-3">
                        {change.oldValue || <span className="italic">(empty)</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">After</p>
                      <p className="text-green-600/80 line-clamp-3">
                        {change.newValue || <span className="italic">(empty)</span>}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
