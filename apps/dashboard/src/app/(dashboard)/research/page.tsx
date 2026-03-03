"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/skeletons";
import { Plus, FlaskConical, Search, Users, Trash2, User, Star, DollarSign, Zap, Calendar } from "lucide-react";
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
          {projects.map((project) => (
            <Link key={project.id} href={`/research/${project.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteTarget(project);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Summary stat cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                    <MiniStat
                      icon={<Search className="h-3.5 w-3.5" />}
                      label="Keywords"
                      value={String(project.keywordCount)}
                    />
                    <MiniStat
                      icon={<Users className="h-3.5 w-3.5" />}
                      label="Competitors"
                      value={String(project.competitorCount)}
                    />
                    <MiniStat
                      icon={<Star className="h-3.5 w-3.5 text-yellow-500" />}
                      label="Avg Rating"
                      value={project.avgRating != null ? `${project.avgRating}` : "—"}
                      sub={project.avgReviews != null ? `${project.avgReviews.toLocaleString()} avg reviews` : undefined}
                    />
                    <MiniStat
                      icon={<DollarSign className="h-3.5 w-3.5" />}
                      label="Pricing"
                      value={
                        project.minPrice != null && project.maxPrice != null
                          ? `$${project.minPrice} — $${project.maxPrice}`
                          : "—"
                      }
                    />
                    <MiniStat
                      icon={<Zap className="h-3.5 w-3.5" />}
                      label="Avg Power"
                      value={project.avgPower != null ? String(project.avgPower) : "—"}
                      sub={project.maxPower != null ? `${project.maxPower} max` : undefined}
                    />
                    <MiniStat
                      icon={<Calendar className="h-3.5 w-3.5" />}
                      label="Updated"
                      value={formatDate(project.updatedAt)}
                    />
                  </div>

                  {/* Footer: creator + dates */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
                    {project.creatorName && (
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {project.creatorName}
                      </span>
                    )}
                    <span>Created {formatDate(project.createdAt)}</span>
                    <span>Updated {formatDate(project.updatedAt)}</span>
                  </div>
                </CardContent>
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

function MiniStat({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      <div className="text-sm font-semibold">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
