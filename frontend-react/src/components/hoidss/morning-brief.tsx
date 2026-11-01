import { ChevronRight } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";

import { cn } from "@/lib/utils";
import { healthText, Panel, StatusPill } from "./primitives";
import { useMorningBrief } from "./useHoidssData";

function HealthGauge({ score, delta }: { score: number; delta: number }) {
  const r = 54;
  const c = Math.PI * r;
  const filled = (score / 100) * c;
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[76px] w-[136px] shrink-0">
        <svg viewBox="0 0 136 76" className="h-full w-full" aria-hidden focusable="false">
          <path
            d="M14 68 A54 54 0 0 1 122 68"
            fill="none"
            stroke="var(--border-strong)"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M14 68 A54 54 0 0 1 122 68"
            fill="none"
            stroke="var(--warn)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${c}`}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <span className="num text-3xl font-semibold">{score}</span>
          <span className="ml-1 text-xs text-muted-foreground">/100</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="label-eyebrow">Hostel health score</p>
        <p className={cn("num mt-1 text-sm font-medium", delta < 0 ? "text-crit-foreground" : "text-ok-foreground")}>
          {delta > 0 ? "+" : ""}
          {delta} pts vs last week
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Composite of complaints, SLA, infrastructure, housekeeping and satisfaction.
        </p>
      </div>
    </div>
  );
}

export function MorningBrief({ onSelectActivity }: { onSelectActivity?: (filter: any) => void }) {
  const navigate = useNavigate();
  const { data, isLoading } = useMorningBrief();

  if (isLoading || !data) {
    return (
      <section className="scroll-mt-36 animate-pulse opacity-50">
        <div className="h-48 rounded-2xl bg-card border border-border"></div>
      </section>
    );
  }

  const { HOSTEL, RECENT_LEDGER, AI_BRIEF } = data;

  const handleActivityClick = (line: any) => {
    if (onSelectActivity) {
      onSelectActivity(line.filter || line.scope || {});
      return;
    }
    const filter = line.filter || {};
    if (filter.recent24h) {
      navigate('/incharge-dashboard?tab=complaints&time=today');
    } else if (filter.status === 'Resolved' || filter.thisMonth) {
      navigate('/incharge-dashboard?tab=complaints&status=Resolved&time=this_month');
    } else if (filter.overdue) {
      navigate('/incharge-dashboard?tab=complaints&overdue=true');
    } else if (filter.category) {
      navigate(`/incharge-dashboard?tab=complaints&category=${filter.category}`);
    } else if (filter.status) {
      navigate(`/incharge-dashboard?tab=complaints&status=${filter.status}`);
    } else {
      navigate('/incharge-dashboard?tab=complaints');
    }
  };

  return (
    <section id="band-brief" aria-labelledby="brief-title" className="scroll-mt-36">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" aria-hidden />
        <p className="label-eyebrow text-xs font-bold tracking-widest uppercase text-primary">
          Executive Brief · {HOSTEL.shift}
        </p>
      </div>
      <h2 id="brief-title" className="mt-2 mb-8 max-w-5xl text-3xl font-extrabold leading-[1.3] tracking-tight sm:text-4xl lg:text-[2.5rem] text-foreground">
        {AI_BRIEF[0]}
      </h2>

      <div className="mt-8 grid gap-8 lg:gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] items-start">
        <Panel title="Recent activity" subtitle="Summary of recent operational events — select to filter complaints">
          <ul className="mt-4 flex-1 flex flex-col justify-between space-y-3.5">
            {RECENT_LEDGER.map((line: any) => (
              <li key={line.text} className="flex-1">
                <button
                  type="button"
                  onClick={() => handleActivityClick(line)}
                  className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-border/70 bg-surface/50 p-4 text-left transition-all duration-200 hover:border-primary/50 hover:bg-surface hover:shadow-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full",
                        line.emphasis === "crit"
                          ? "bg-crit shadow-sm shadow-crit/50"
                          : line.emphasis === "warn"
                          ? "bg-warn shadow-sm shadow-warn/50"
                          : line.emphasis === "ok"
                          ? "bg-ok shadow-sm shadow-ok/50"
                          : "bg-muted-foreground/40",
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "min-w-0 text-base font-semibold leading-snug",
                        line.emphasis ? healthText[line.emphasis] : "text-foreground/90",
                      )}
                    >
                      {line.text}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {line.emphasis === "crit" ? (
                      <span className="rounded-lg bg-crit-soft px-2.5 py-1 text-xs font-extrabold text-crit-foreground">
                        Action Required
                      </span>
                    ) : line.emphasis === "warn" ? (
                      <span className="rounded-lg bg-warn-soft px-2.5 py-1 text-xs font-bold text-warn-foreground">
                        Warning
                      </span>
                    ) : line.emphasis === "ok" ? (
                      <span className="rounded-lg bg-ok-soft px-2.5 py-1 text-xs font-bold text-ok-foreground">
                        Resolved
                      </span>
                    ) : null}
                    <ChevronRight
                      className="h-5 w-5 text-muted-foreground opacity-40 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100 group-hover:text-primary"
                      aria-hidden
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-6">
          <Panel className="p-7 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <HealthGauge score={HOSTEL.healthScore} delta={HOSTEL.healthDelta} />
              <StatusPill health={HOSTEL.status === "Critical" ? "crit" : HOSTEL.status === "Strained" ? "warn" : "ok"}>
                {HOSTEL.status}
              </StatusPill>
            </div>
          </Panel>
        </div>
      </div>
    </section>
  );
}
