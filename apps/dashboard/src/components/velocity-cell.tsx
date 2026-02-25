"use client";

export function VelocityCell({
  value,
}: {
  value: number | null | undefined;
}) {
  if (value == null) {
    return <span className="text-muted-foreground">{"\u2014"}</span>;
  }

  return <span>{value === 0 ? "0" : `+${value}`}</span>;
}
