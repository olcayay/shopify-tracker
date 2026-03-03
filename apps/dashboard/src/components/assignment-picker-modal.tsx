"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";

export interface AssignmentItem {
  id: string;
  label: string;
  iconUrl?: string;
  type: "app" | "research";
}

interface AssignmentPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (toAdd: AssignmentItem[], toRemove: AssignmentItem[]) => Promise<void>;
  title: string;
  items: AssignmentItem[];
  initialChecked: Set<string>;
  excludeId?: string;
}

export function AssignmentPickerModal({
  open,
  onClose,
  onSave,
  title,
  items,
  initialChecked,
  excludeId,
}: AssignmentPickerModalProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set(initialChecked));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Sync checked state when initialChecked changes (e.g. after async fetch)
  useEffect(() => {
    setChecked(new Set(initialChecked));
  }, [initialChecked]);

  if (!open) return null;

  const filteredItems = excludeId
    ? items.filter((item) => item.id !== excludeId)
    : items;

  const appItems = filteredItems.filter((i) => i.type === "app");
  const researchItems = filteredItems.filter((i) => i.type === "research");

  const hasNoItems = appItems.length === 0 && researchItems.length === 0;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError("");

    const toAdd: AssignmentItem[] = [];
    const toRemove: AssignmentItem[] = [];

    for (const item of filteredItems) {
      const wasChecked = initialChecked.has(item.id);
      const isChecked = checked.has(item.id);
      if (!wasChecked && isChecked) toAdd.push(item);
      if (wasChecked && !isChecked) toRemove.push(item);
    }

    try {
      await onSave(toAdd, toRemove);
      onClose();
    } catch (err: any) {
      setError(err.message || "Some operations failed");
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = filteredItems.some((item) => {
    const wasChecked = initialChecked.has(item.id);
    const isChecked = checked.has(item.id);
    return wasChecked !== isChecked;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background border rounded-lg shadow-lg p-6 max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
        <h3 className="text-lg font-semibold">{title}</h3>

        {hasNoItems ? (
          <p className="text-sm text-muted-foreground mt-4">
            Follow an app or create a research project first.
          </p>
        ) : (
          <div className="mt-4 overflow-y-auto flex-1 -mx-6 px-6">
            {appItems.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Your Apps
                </p>
                <div className="space-y-1">
                  {appItems.map((item) => (
                    <CheckboxRow
                      key={item.id}
                      item={item}
                      isChecked={checked.has(item.id)}
                      onToggle={() => toggle(item.id)}
                    />
                  ))}
                </div>
              </div>
            )}
            {researchItems.length > 0 && (
              <div className={appItems.length > 0 ? "mt-4" : ""}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Research Projects
                </p>
                <div className="space-y-1">
                  {researchItems.map((item) => (
                    <CheckboxRow
                      key={item.id}
                      item={item}
                      isChecked={checked.has(item.id)}
                      onToggle={() => toggle(item.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive mt-3">{error}</p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {!hasNoItems && (
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckboxRow({
  item,
  isChecked,
  onToggle,
}: {
  item: AssignmentItem;
  isChecked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className="w-full text-left px-2 py-1.5 rounded-md hover:bg-accent text-sm flex items-center gap-2"
      onClick={onToggle}
    >
      <div
        className={`h-4 w-4 rounded border shrink-0 flex items-center justify-center ${
          isChecked ? "bg-primary border-primary" : "border-input"
        }`}
      >
        {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
      </div>
      {item.iconUrl && (
        <img src={item.iconUrl} alt="" className="h-5 w-5 rounded shrink-0" />
      )}
      <span className="flex-1 truncate">{item.label}</span>
    </button>
  );
}
