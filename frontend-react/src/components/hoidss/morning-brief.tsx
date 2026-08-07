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
    <section id="band-brief" aria-labelledby="brief-title" className="scroll-mt-32">
      <p className="label-eyebrow">Executive morning brief · Wednesday 05 August, 07:10</p>
      <h2 id="brief-title" className="mt-3 max-w-4xl text-[1.75rem] font-semibold leading-[1.2] tracking-tight sm:text-[2.125rem]">
        Housekeeping and occupancy are holding. Block B electrical is degrading faster than maintenance can absorb.
      </h2>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <Panel title="Overnight ledger" subtitle="Since 22:00 yesterday">
          <ul className="divide-y divide-border">
            {OVERNIGHT_LEDGER.map((line) => (
              <li key={line.text}>
                <button
                  type="button"
                  onClick={() => narrow(line.scope ?? {})}
                  className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-left transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "min-w-0 text-[0.9375rem] leading-6",
                      line.emphasis ? healthText[line.emphasis] : "text-foreground/90",
                    )}
                  >
                    {line.text}
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="space-y-5">
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <HealthGauge score={HOSTEL.healthScore} delta={HOSTEL.healthDelta} />
              <StatusPill health="warn">{HOSTEL.status}</StatusPill>
            </div>
          </Panel>

          <Panel className="border-primary/30 bg-info-soft/40">
            <p className="label-eyebrow">Today's priority</p>
            <h3 className="mt-2 text-lg font-semibold leading-6">{TODAY_PRIORITY.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{TODAY_PRIORITY.detail}</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                size="sm"
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
              <span className="text-xs text-muted-foreground">Owner · {TODAY_PRIORITY.owner}</span>
            </div>
          </Panel>

          <Panel>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden />
              <p className="label-eyebrow">AI executive summary · 92% confidence</p>
            </div>
            <ul className="mt-3 space-y-2.5">
              {AI_BRIEF.map((line) => (
                <li key={line} className="text-[0.9375rem] leading-6 text-foreground/90">
                  {line}
                </li>
              ))}
            </ul>
            <a
              href="#band-mission"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              Open mission control <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          </Panel>
        </div>
      </div>
    </section>
  );
}
