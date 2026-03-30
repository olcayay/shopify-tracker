"use client";

import { Button } from "@/components/ui/button";

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterButtonGroupProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  size?: "xs" | "sm" | "default";
}

export function FilterButtonGroup({
  options,
  value,
  onChange,
  size = "sm",
}: FilterButtonGroupProps) {
  return (
    <div className="flex gap-1.5">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "default" : "outline"}
          size={size === "xs" ? "sm" : size}
          className={size === "xs" ? "h-7 px-2 text-xs" : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count != null && (
            <span className="ml-1 text-muted-foreground">({option.count})</span>
          )}
        </Button>
      ))}
    </div>
  );
}
