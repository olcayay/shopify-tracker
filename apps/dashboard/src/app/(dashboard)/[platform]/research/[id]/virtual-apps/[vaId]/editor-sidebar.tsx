"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Save,
  Loader2,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SECTIONS } from "./constants";
import type { VirtualAppEditorState } from "./use-virtual-app-editor";

export function EditorSidebar({ state }: { state: VirtualAppEditorState }) {
  const {
    platform,
    id,
    vaId,
    isNew,
    canEdit,
    saving,
    name,
    icon,
    color,
    activeSection,
    scrollToSection,
    handleBack,
    saveTextFields,
    router,
  } = state;

  return (
    <div className="hidden lg:block w-48 shrink-0">
      <div className="sticky top-4 space-y-1">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Project
        </button>
        <div className="flex items-center gap-2 mb-4">
          <div
            className="h-6 w-6 rounded flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${color}20` }}
          >
            <span className="text-xs">{icon}</span>
          </div>
          <span className="font-semibold text-sm truncate">{name || "My App"}</span>
          {isNew && <Badge variant="secondary" className="text-[10px] px-1 py-0">New</Badge>}
        </div>
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              className={cn(
                "flex items-center gap-2 w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors",
                activeSection === s.id
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {s.label}
            </button>
          );
        })}

        {/* Preview button */}
        {!isNew ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3"
            onClick={() => router.push(`/${platform}/research/${id}/virtual-apps/${vaId}/preview`)}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Preview
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 opacity-50 cursor-not-allowed"
            disabled
            title="Save first to preview"
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Preview
          </Button>
        )}

        {canEdit && (
          <Button
            onClick={saveTextFields}
            disabled={saving}
            className="w-full mt-2"
            size="sm"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1.5" />
            )}
            {isNew ? "Create" : "Save"}
          </Button>
        )}
      </div>
    </div>
  );
}
