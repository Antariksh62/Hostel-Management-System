import { ArrowUpRight, ChevronRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInvestigation } from "./context";
import { AI_BRIEF, HOSTEL, OVERNIGHT_LEDGER, TODAY_PRIORITY } from "./data";
import { healthText, Panel, StatusPill } from "./primitives";

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

export function MorningBrief() {
  const { narrow, openDrawer } = useInvestigation();

  return (
    <section id="band-brief" aria-labelledby="brief-title" className="scroll-mt-36">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" aria-hidden />
        <p className="label-eyebrow text-xs font-bold tracking-widest uppercase text-primary">
          Executive Morning Brief · Wednesday 05 August, 07:10
        </p>
      </div>
      <h2 id="brief-title" className="mt-2 mb-10 max-w-5xl text-3xl font-extrabold leading-[1.3] tracking-tight sm:text-4xl lg:text-[2.5rem] text-foreground">
        Housekeeping and occupancy are holding. Block B electrical is degrading faster than maintenance can absorb.
      </h2>

      <div className="mt-10 grid gap-10 lg:gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Panel title="Overnight ledger" subtitle="Activity recorded since 22:00 yesterday">
          <ul className="mt-4 flex-1 flex flex-col justify-between space-y-3.5">
            {OVERNIGHT_LEDGER.map((line) => (
              <li key={line.text} className="flex-1">
                <button
                  type="button"
                  onClick={() => narrow(line.scope ?? {})}
                  className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-border/70 bg-surface/50 p-4.5 text-left transition-all duration-200 hover:border-primary/50 hover:bg-surface hover:shadow-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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

        <div className="space-y-8 lg:space-y-10">
          <Panel className="p-7 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <HealthGauge score={HOSTEL.healthScore} delta={HOSTEL.healthDelta} />
              <StatusPill health="warn">{HOSTEL.status}</StatusPill>
            </div>
          </Panel>

          <Panel className="relative overflow-hidden border-primary/50 bg-gradient-to-br from-primary/10 via-card to-card p-8 lg:p-10 shadow-lift">
            <div className="flex items-center justify-between gap-4 mb-2">
              <p className="label-eyebrow font-extrabold tracking-widest text-primary">Today's priority</p>
              <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-extrabold text-primary">
                High SLA Risk
              </span>
            </div>
            <h3 className="mt-3 text-2xl font-extrabold leading-snug text-foreground">{TODAY_PRIORITY.title}</h3>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">{TODAY_PRIORITY.detail}</p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <Button
                size="lg"
                className="gap-2.5 px-7 py-3.5 text-sm font-extrabold shadow-lg shadow-primary/20 transition-all duration-200 hover:scale-[1.02]"
                onClick={() =>
                  openDrawer({
                    kind: "Alert",
                    title: "Block B electrical inspection",
                    subtitle: "Awaiting warden approval · raised 07:02",
                    health: "crit",
                    facts: [
                      { label: "Owner", value: TODAY_PRIORITY.owner },
                      { label: "SLA clocks protected", value: "4" },
                      { label: "Estimated cost if ignored", value: "₹18,000" },
                    ],
                  })
                }
              >
                Approve inspection
              </Button>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Owner · {TODAY_PRIORITY.owner}
              </span>
            </div>
          </Panel>

          <Panel className="p-8 lg:p-10">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden />
              <p className="label-eyebrow font-extrabold tracking-wider text-primary">AI executive summary · 92% confidence</p>
            </div>
            <ul className="mt-6 space-y-4">
              {AI_BRIEF.map((line) => (
                <li key={line} className="flex gap-3 text-base leading-relaxed text-foreground/90 font-normal">
                  <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <a
              href="#band-mission"
              className="mt-8 inline-flex items-center gap-2 text-sm font-extrabold text-primary hover:underline"
            >
              Open mission control <ArrowUpRight className="h-4.5 w-4.5" aria-hidden />
            </a>
          </Panel>
        </div>
      </div>
    </section>
  );
}
