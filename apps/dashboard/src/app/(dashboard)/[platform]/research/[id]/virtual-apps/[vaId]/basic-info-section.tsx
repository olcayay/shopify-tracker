"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sparkles,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_SET, COLOR_SET } from "./constants";
import type { VirtualAppEditorState } from "./use-virtual-app-editor";

export function BasicInfoSection({ state }: { state: VirtualAppEditorState }) {
  const {
    canEdit,
    name,
    setName,
    icon,
    setIcon,
    color,
    setColor,
    iconUrl,
    setIconUrl,
    subtitle,
    setSubtitle,
    dirty,
  } = state;

  return (
    <Card id="sec-basic" className="scroll-mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4" /> Basic Info
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1 block">App Name</label>
          <Input
            value={name}
            onChange={(e) => dirty(setName)(e.target.value)}
            disabled={!canEdit}
            className="max-w-md"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Subtitle</label>
          <Input
            value={subtitle}
            onChange={(e) => dirty(setSubtitle)(e.target.value)}
            disabled={!canEdit}
            className="max-w-lg"
            placeholder="Short tagline..."
          />
          <p className="text-xs text-muted-foreground mt-1">{subtitle.length}/62 characters</p>
        </div>

        {/* Icon Picker */}
        <div>
          <label className="text-sm font-medium mb-2 block">Icon</label>
          <div className="flex flex-wrap gap-1.5">
            {ICON_SET.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => dirty(setIcon)(emoji)}
                disabled={!canEdit}
                className={cn(
                  "h-9 w-9 rounded-lg flex items-center justify-center text-lg transition-all",
                  icon === emoji
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background bg-muted"
                    : "hover:bg-muted/50"
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Color Picker */}
        <div>
          <label className="text-sm font-medium mb-2 block">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_SET.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => dirty(setColor)(c)}
                disabled={!canEdit}
                className={cn(
                  "h-7 w-7 rounded-full transition-all",
                  color === c
                    ? "ring-2 ring-offset-2 ring-offset-background scale-110"
                    : "hover:scale-110"
                )}
                style={{
                  backgroundColor: c,
                  ...(color === c ? { ["--tw-ring-color" as any]: c } : {}),
                }}
              />
            ))}
          </div>
        </div>

        {/* Custom Icon URL */}
        <div>
          <label className="text-sm font-medium mb-1 flex items-center gap-1.5">
            <LinkIcon className="h-3.5 w-3.5" /> Custom Icon URL
          </label>
          <Input
            value={iconUrl}
            onChange={(e) => dirty(setIconUrl)(e.target.value)}
            disabled={!canEdit}
            className="max-w-lg"
            placeholder="https://... (overrides emoji icon)"
          />
          {iconUrl && (
            <div className="mt-2 flex items-center gap-2">
              <img
                src={iconUrl}
                alt="preview"
                className="h-8 w-8 rounded object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="text-xs text-muted-foreground">Preview</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
