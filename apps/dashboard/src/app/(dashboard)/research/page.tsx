"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/skeletons";
import { Plus, FlaskConical, Search, Users, Trash2, User } from "lucide-react";
import { ConfirmModal } from "@/components/confirm-modal";

export default function ResearchListPage() {
  const { fetchWithAuth, user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link key={project.id} href={`/research/${project.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{project.name}</h3>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Search className="h-3.5 w-3.5" />
                          {project.keywordCount} keywords
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {project.competitorCount} competitors
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {project.creatorName && (
                          <span className="inline-flex items-center gap-1 mr-2">
                            <User className="h-3 w-3" />
                            {project.creatorName}
                          </span>
                        )}
                        Updated {new Date(project.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
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
