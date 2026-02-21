"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Check, Trash2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TAG_COLORS, getTagColorClasses } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

interface KeywordTag {
  id: string;
  name: string;
  color: string;
}

interface KeywordTagManagerProps {
  keywordId: number;
  currentTags: KeywordTag[];
  allTags: KeywordTag[];
  onAssign: (tagId: string) => Promise<void>;
  onUnassign: (tagId: string) => Promise<void>;
  onCreateTag: (name: string, color: string) => Promise<void>;
  onDeleteTag: (tagId: string) => Promise<void>;
  onUpdateTag: (tagId: string, color: string, name?: string) => Promise<void>;
  className?: string;
}

export function KeywordTagManager({
  keywordId,
  currentTags,
  allTags,
  onAssign,
  onUnassign,
  onCreateTag,
  onDeleteTag,
  onUpdateTag,
  className,
}: KeywordTagManagerProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(TAG_COLORS[0].key);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editColor, setEditColor] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setEditingId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentTagIds = new Set(currentTags.map((t) => t.id));

  async function handleToggle(tagId: string) {
    if (busy) return;
    setBusy(true);
    if (currentTagIds.has(tagId)) {
      await onUnassign(tagId);
    } else {
      await onAssign(tagId);
    }
    setBusy(false);
  }

  async function handleCreate() {
    if (busy || !newName.trim()) return;
    setBusy(true);
    await onCreateTag(newName.trim(), newColor);
    setNewName("");
    setNewColor(TAG_COLORS[0].key);
    setCreating(false);
    setBusy(false);
  }

  async function handleDelete(tagId: string) {
    if (busy) return;
    setBusy(true);
    await onDeleteTag(tagId);
    setBusy(false);
  }

  async function handleUpdateColor(tagId: string, color: string) {
    if (busy) return;
    setBusy(true);
    await onUpdateTag(tagId, color);
    setEditingId(null);
    setEditColor("");
    setBusy(false);
  }

  return (
    <div ref={ref} className={cn("relative inline-flex", className, open && "!opacity-100")}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
          setCreating(false);
          setEditingId(null);
        }}
        className="inline-flex items-center justify-center h-4 w-4 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
        title="Manage tags"
      >
        <Plus className="h-3 w-3" />
      </button>

      {open && (
        <div
          className="absolute z-50 top-full mt-1 left-0 w-56 bg-popover border rounded-md shadow-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Existing tags */}
          {allTags.length > 0 && (
            <div className="max-h-48 overflow-auto">
              {allTags.map((tag) => {
                const colors = getTagColorClasses(tag.color);
                const isAssigned = currentTagIds.has(tag.id);
                const isEditing = editingId === tag.id;

                return (
                  <div key={tag.id} className="group">
                    {isEditing ? (
                      <div className="px-2 py-1.5 border-b">
                        <div className="flex gap-1 flex-wrap mb-1.5">
                          {TAG_COLORS.map((c) => (
                            <button
                              key={c.key}
                              onClick={() =>
                                handleUpdateColor(tag.id, c.key)
                              }
                              className={cn(
                                "h-5 w-5 rounded-full border-2 transition-all",
                                c.dot,
                                editColor === c.key || (!editColor && tag.color === c.key)
                                  ? "border-foreground scale-110"
                                  : "border-transparent opacity-60 hover:opacity-100"
                              )}
                            />
                          ))}
                        </div>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center px-2 py-1.5 hover:bg-accent text-sm">
                        <button
                          onClick={() => handleToggle(tag.id)}
                          className="flex items-center gap-2 flex-1 min-w-0"
                        >
                          <div
                            className={cn(
                              "h-3 w-3 rounded-full shrink-0",
                              colors.dot
                            )}
                          />
                          <span className="truncate">{tag.name}</span>
                          {isAssigned && (
                            <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-auto" />
                          )}
                        </button>
                        <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => {
                              setEditingId(tag.id);
                              setEditColor(tag.color);
                            }}
                            className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-muted"
                            title="Change color"
                          >
                            <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDelete(tag.id)}
                            className="h-5 w-5 inline-flex items-center justify-center rounded hover:bg-muted"
                            title="Delete tag"
                          >
                            <Trash2 className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Create new tag */}
          {creating ? (
            <div className="p-2 border-t space-y-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Tag name..."
                className="h-7 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setCreating(false);
                }}
              />
              <div className="flex gap-1 flex-wrap">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setNewColor(c.key)}
                    className={cn(
                      "h-5 w-5 rounded-full border-2 transition-all",
                      c.dot,
                      newColor === c.key
                        ? "border-foreground scale-110"
                        : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  />
                ))}
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  className="h-6 text-xs flex-1"
                  onClick={handleCreate}
                  disabled={!newName.trim() || busy}
                >
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => setCreating(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full text-left px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-2 border-t"
            >
              <Plus className="h-3.5 w-3.5" />
              Create new tag
            </button>
          )}
        </div>
      )}
    </div>
  );
}
