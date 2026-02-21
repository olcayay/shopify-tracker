export const TAG_COLORS = [
  {
    key: "red",
    bg: "bg-red-500/20",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-500/50",
    dot: "bg-red-500",
  },
  {
    key: "orange",
    bg: "bg-orange-500/20",
    text: "text-orange-700 dark:text-orange-400",
    border: "border-orange-500/50",
    dot: "bg-orange-500",
  },
  {
    key: "amber",
    bg: "bg-amber-500/20",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-500/50",
    dot: "bg-amber-500",
  },
  {
    key: "emerald",
    bg: "bg-emerald-500/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-500/50",
    dot: "bg-emerald-500",
  },
  {
    key: "cyan",
    bg: "bg-cyan-500/20",
    text: "text-cyan-700 dark:text-cyan-400",
    border: "border-cyan-500/50",
    dot: "bg-cyan-500",
  },
  {
    key: "blue",
    bg: "bg-blue-500/20",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-500/50",
    dot: "bg-blue-500",
  },
  {
    key: "violet",
    bg: "bg-violet-500/20",
    text: "text-violet-700 dark:text-violet-400",
    border: "border-violet-500/50",
    dot: "bg-violet-500",
  },
  {
    key: "pink",
    bg: "bg-pink-500/20",
    text: "text-pink-700 dark:text-pink-400",
    border: "border-pink-500/50",
    dot: "bg-pink-500",
  },
  {
    key: "slate",
    bg: "bg-slate-500/20",
    text: "text-slate-700 dark:text-slate-400",
    border: "border-slate-500/50",
    dot: "bg-slate-500",
  },
  {
    key: "rose",
    bg: "bg-rose-500/20",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-500/50",
    dot: "bg-rose-500",
  },
] as const;

export type TagColorKey = (typeof TAG_COLORS)[number]["key"];

export function getTagColorClasses(colorKey: string) {
  return (
    TAG_COLORS.find((c) => c.key === colorKey) ||
    TAG_COLORS[TAG_COLORS.length - 1]
  );
}
