import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone = "neutral" | "info" | "warning" | "critical" | "success";

const TONE: Record<StatTone, string> = {
  neutral: "text-foreground",
  info: "text-[var(--hms-info-foreground)]",
  warning: "text-[var(--hms-warning-foreground)]",
  critical: "text-[var(--hms-critical-foreground)]",
  success: "text-[var(--hms-success-foreground)]",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: StatTone;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {Icon ? <Icon className="size-4 text-muted-foreground" aria-hidden /> : null}
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl", TONE[tone])}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
