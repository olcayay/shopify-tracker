"use client";

import { useState, useMemo } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  /** All integrations across competitors */
  competitorIntegrations: string[];
  /** Currently selected integrations */
  selectedIntegrations: string[];
  onAdd: (integration: string) => void;
  onRemove: (integration: string) => void;
  disabled?: boolean;
}

export function IntegrationPicker({
  competitorIntegrations, selectedIntegrations, onAdd, onRemove, disabled,
}: Props) {
  const [customIntegration, setCustomIntegration] = useState("");
  const [search, setSearch] = useState("");

  const selectedSet = useMemo(() => new Set(selectedIntegrations), [selectedIntegrations]);

  const competitorSet = useMemo(() => new Set(competitorIntegrations), [competitorIntegrations]);
  const customIntegrations = useMemo(
    () => selectedIntegrations.filter((i) => !competitorSet.has(i)),
    [selectedIntegrations, competitorSet]
  );

  const filteredCompetitor = useMemo(() => {
    if (!search.trim()) return competitorIntegrations;
    const q = search.toLowerCase();
    return competitorIntegrations.filter((i) => i.toLowerCase().includes(q));
  }, [competitorIntegrations, search]);

  function handleAddCustom() {
    const i = customIntegration.trim();
    if (!i || selectedSet.has(i)) return;
    onAdd(i);
    setCustomIntegration("");
  }

  return (
    <div className="space-y-3">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter integrations..."
        className="h-8 text-sm"
      />

      <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
        <p className="text-xs text-muted-foreground font-medium px-1 mb-1">From competitors:</p>
        {filteredCompetitor.map((integ) => {
          const isSelected = selectedSet.has(integ);
          return (
            <button
              key={integ}
              onClick={() => {
                if (disabled) return;
                if (isSelected) onRemove(integ);
                else onAdd(integ);
              }}
              disabled={disabled}
              className={cn(
                "flex items-center gap-2 w-full text-left py-1 px-2 rounded text-sm transition-colors",
                isSelected ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300" : "hover:bg-muted/50"
              )}
            >
              <div className={cn(
                "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                isSelected ? "bg-blue-600 border-blue-600" : "border-muted-foreground/30"
              )}>
                {isSelected && <Check className="h-3 w-3 text-white" />}
              </div>
              <span className="truncate">{integ}</span>
            </button>
          );
        })}
        {filteredCompetitor.length === 0 && (
          <p className="text-xs text-muted-foreground italic px-2 py-1">No matching integrations</p>
        )}
      </div>

      {customIntegrations.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground font-medium px-1 mb-1">Custom:</p>
          <div className="flex flex-wrap gap-1.5">
            {customIntegrations.map((i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs"
              >
                {i}
                <button onClick={() => onRemove(i)} disabled={disabled} className="hover:text-red-600">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={customIntegration}
          onChange={(e) => setCustomIntegration(e.target.value)}
          placeholder="Add custom integration..."
          className="h-8 text-sm flex-1"
          onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
        />
        <Button size="sm" variant="secondary" onClick={handleAddCustom} disabled={disabled || !customIntegration.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
