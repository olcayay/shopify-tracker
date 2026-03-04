"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/skeletons";
import { Plus, FlaskConical, Search, Users, Trash2, User, Star, Zap } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";

interface Project {
  id: string;
  name: string;
  creatorName: string | null;
  createdAt: string;
  updatedAt: string;
  keywordCount: number;
  competitorCount: number;
  avgRating: number | null;
  avgReviews: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  avgPower: number | null;
  maxPower: number | null;
}

export default function ResearchListPage() {
  const { fetchWithAuth, user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const canEdit = user?.role === "owner" || user?.role === "editor";

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const res = await fetchWithAuth("/api/research-projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    setCreating(true);
    try {
      const res = await fetchWithAuth("/api/research-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const project = await res.json();
        router.push(`/research/${project.id}`);
      }
    } finally {
      setCreating(false);
    }
  }

  async function deleteProject(id: string) {
    const res = await fetchWithAuth(`/api/research-projects/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
    }
    setDeleteTarget(null);
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Research Projects</h1>
        <TableSkeleton rows={3} cols={3} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Research Projects</h1>
        {canEdit && (
          <Button onClick={createProject} disabled={creating}>
            <Plus className="h-4 w-4 mr-2" />
            {creating ? "Creating..." : "New Project"}
          </Button>
        )}
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">No research projects yet</h2>
            <p className="text-muted-foreground text-sm mb-6 text-center max-w-md">
              Start a research project to explore market opportunities. Add keywords and discover competitors, categories, and feature gaps.
            </p>
            {canEdit && (
              <Button onClick={createProject} disabled={creating}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {projects.map((p) => (
            <Link key={p.id} href={`/research/${p.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer group overflow-hidden">
                {/* Title row */}
                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                  <h3 className="text-lg font-semibold truncate">{p.name}</h3>
                  {canEdit && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeleteTarget(p);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Summary stat cards — same style as detail page */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-5 pb-3">
                  {/* Market Overview */}
                  <SummaryStatCard emoji="📊" title="Market Overview" gradient="from-blue-500 to-cyan-400">
                    <StatRow label="Competitors" value={String(p.competitorCount)} />
                    {p.avgRating != null && (
                      <StatRow
                        label={<span className="flex items-center gap-1"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{p.avgRating} avg</span>}
                        value={p.avgReviews != null ? `${p.avgReviews.toLocaleString()} reviews` : ""}
                      />
                    )}
                    {p.minPrice != null && p.maxPrice != null && (
                      <StatRow label="Pricing" value={`$${p.minPrice} — $${p.maxPrice}/mo`} />
                    )}
                  </SummaryStatCard>

                  {/* Competition */}
                  {p.avgPower != null ? (
                    <SummaryStatCard emoji="⚔️" title="Competition" gradient="from-orange-500 to-amber-400">
                      <StatRow label="Avg power" value={String(p.avgPower)} />
                      {p.maxPower != null && (
                        <StatRow label="Strongest" value={String(p.maxPower)} />
                      )}
                    </SummaryStatCard>
                  ) : (
                    <SummaryStatCard emoji="⚔️" title="Competition" gradient="from-orange-500 to-amber-400">
                      <span className="text-xs text-muted-foreground">No data yet</span>
                    </SummaryStatCard>
                  )}

                  {/* Keywords */}
                  <SummaryStatCard emoji="🔍" title="Keywords" gradient="from-emerald-500 to-green-400">
                    <StatRow label="Tracked" value={String(p.keywordCount)} />
                  </SummaryStatCard>

                  {/* Activity */}
                  <SummaryStatCard emoji="📅" title="Activity" gradient="from-violet-500 to-purple-400">
                    <StatRow label="Created" value={formatDate(p.createdAt)} />
                    <StatRow label="Updated" value={formatDate(p.updatedAt)} />
                  </SummaryStatCard>
                </div>

                {/* Footer */}
                {p.creatorName && (
                  <div className="px-5 pb-3 text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {p.creatorName}
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Research Project"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && deleteProject(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function SummaryStatCard({
  emoji, title, gradient, children,
}: {
  emoji: string; title: string; gradient: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border overflow-hidden shadow-sm">
      <div className={`h-1 bg-gradient-to-r ${gradient}`} />
      <div className="px-3 pt-2 pb-2.5">
        <div className="flex flex-col items-center mb-1.5">
          <span className="text-lg">{emoji}</span>
          <span className="text-xs font-semibold">{title}</span>
        </div>
        <div className="space-y-0.5 text-xs">{children}</div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
