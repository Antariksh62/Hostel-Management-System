import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronDown, Minus } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { cn } from "@/lib/utils";
import { useInvestigation } from "./context";
import type { Health } from "./data";

export const healthText: Record<Health, string> = {
  ok: "text-ok-foreground",
  warn: "text-warn-foreground",
  crit: "text-crit-foreground",
};

export const healthSoft: Record<Health, string> = {
  ok: "bg-ok-soft text-ok-foreground",
  warn: "bg-warn-soft text-warn-foreground",
  crit: "bg-crit-soft text-crit-foreground",
};

export const healthRail: Record<Health, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  crit: "bg-crit",
};

export function StatusPill({ health, children }: { health: Health; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        healthSoft[health],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", healthRail[health])} aria-hidden />
      {children}
    </span>
  );
}

export function DeltaChip({ delta, dir }: { delta: string; dir: "up" | "down" | "flat" }) {
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  return (
    <span className="num inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground">
      <Icon className="h-3 w-3" aria-hidden />
      {delta}
    </span>
  );
}

/** Tiny inline trend line. Purely indicative, no axes. */
export function Sparkline({ data, health }: { data: number[]; health: Health }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / span) * 24 - 2}`)
    .join(" ");
  const stroke = health === "crit" ? "var(--crit)" : health === "warn" ? "var(--warn)" : "var(--ok)";
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="h-7 w-full" aria-hidden focusable="false">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** A page band: one question, one verdict, optional disclosure of detail. */
export function Band({
  id,
  question,
  verdict,
  aside,
  children,
  detail,
  detailLabel,
  detailSummary,
}: {
  id: string;
  question: string;
  verdict: string;
  aside?: ReactNode | undefined;
  children?: ReactNode | undefined;
  detail?: ReactNode | undefined;
  detailLabel?: string | undefined;
  detailSummary?: string | undefined;
}) {
  const { evidenceTarget } = useInvestigation();
  const highlighted = evidenceTarget === id;

  return (
    <section
      id={`band-${id}`}
      aria-labelledby={`band-title-${id}`}
      className={cn(
        "scroll-mt-36 rounded-3xl transition-shadow duration-300",
        highlighted && "evidence-pulse ring-2 ring-primary/60",
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-6 sm:flex sm:items-end sm:justify-between mb-4">
        <div className="min-w-0">
          <h2 id={`band-title-${id}`} className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            {question}
          </h2>
          <p className="mt-4 max-w-4xl text-base leading-relaxed text-muted-foreground sm:text-lg">{verdict}</p>
        </div>
        {aside ? <div className="shrink-0 pt-2">{aside}</div> : null}
      </div>
      {children ? <div className="mt-10 lg:mt-12">{children}</div> : null}
      {detail ? (
        <Disclosure label={detailLabel ?? "Show detail"} summary={detailSummary}>
          {detail}
        </Disclosure>
      ) : null}
    </section>
  );
}

export function Disclosure({
  label,
  summary,
  children,
  defaultOpen = false,
}: {
  label: string;
  summary?: string | undefined;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className="mt-10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border bg-surface/60 px-6 py-4.5 text-left transition-colors duration-150 hover:border-border-strong hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="min-w-0">
          <span className="text-base font-semibold">{open ? label.replace("Show", "Hide") : label}</span>
          {summary ? <span className="mt-1 block truncate text-sm text-muted-foreground">{summary}</span> : null}
        </span>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={panelId} className="mt-8 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  as = "div",
}: {
  title?: string | undefined;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
  as?: "div" | "article";
}) {
  const Tag = as;
  return (
    <Tag
      className={cn(
        "flex flex-col justify-between rounded-3xl border border-border bg-card p-7 shadow-soft transition-colors duration-150 sm:p-8 lg:p-10",
        className,
      )}
    >
      {title ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 mb-2">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold sm:text-xl">{title}</h3>
            {subtitle ? <p className="label-eyebrow mt-1.5 truncate tracking-wider">{subtitle}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className={title ? "mt-6 flex-1 flex flex-col justify-between" : "flex-1 flex flex-col justify-between"}>{children}</div>
    </Tag>
  );
}

/** The closing line of every visual: what to do about it. */
export function ActionLine({ text, onClick }: { text: string; onClick?: (() => void) | undefined }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group mt-8 grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-dashed border-border/80 bg-surface/40 px-5 py-4 text-left text-xs font-semibold sm:text-sm text-muted-foreground transition-colors duration-150 hover:border-primary/50 hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="min-w-0 truncate">{text}</span>
      <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:translate-x-1 text-primary" aria-hidden />
    </button>
  );
}
