import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { useInvestigation } from "./context";
import { SIGNALS } from "./data";
import { DeltaChip, healthText, Sparkline, StatusPill } from "./primitives";

export function SignalStrip() {
  const { narrow, openDrawer } = useInvestigation();

  return (
    <section id="band-signals" aria-labelledby="signals-title" className="scroll-mt-32">
      <h2 id="signals-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
        What is happening today?
      </h2>
      <p className="mt-2 max-w-3xl text-[0.9375rem] leading-6 text-muted-foreground">
        Six signals, each read as a consequence rather than a number. Anything within tolerance stays quiet.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SIGNALS.map((signal) => (
          <article
            key={signal.id}
            className={cn(
              "group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-soft transition-all duration-150 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift",
              signal.health === "crit" && "border-crit/35",
            )}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <p className="label-eyebrow min-w-0 truncate">{signal.label}</p>
              {signal.health === "ok" ? (
                <StatusPill health="ok">On target</StatusPill>
              ) : (
                <StatusPill health={signal.health}>{signal.health === "crit" ? "Needs action" : "Watch"}</StatusPill>
              )}
            </div>

            <div className="mt-3 flex items-end gap-3">
              <span className={cn("num text-[2rem] font-semibold leading-none", healthText[signal.health])}>
                {signal.value}
              </span>
              <DeltaChip delta={signal.delta} dir={signal.deltaDir} />
            </div>

            <div className="mt-3 -mx-1">
              <Sparkline data={signal.series} health={signal.health} />
            </div>

            <p className="mt-3 min-h-[3rem] text-[0.8125rem] leading-5 text-muted-foreground">{signal.consequence}</p>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3.5">
              {signal.action ? (
                <button
                  type="button"
                  onClick={() => narrow(signal.scope ?? {})}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {signal.action}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : (
                <span className="text-xs text-muted-foreground">No action needed today</span>
              )}
              <button
                type="button"
                onClick={() =>
                  openDrawer({
                    kind: "Signal",
                    title: signal.label,
                    subtitle: `${signal.value} · ${signal.delta} vs last week`,
                    health: signal.health,
                    facts: [
                      { label: "Consequence", value: signal.consequence },
                      { label: "Recommended action", value: signal.action ?? "Hold — within tolerance" },
                      { label: "Window", value: "Last 14 days" },
                    ],
                  })
                }
                className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                Drill down
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
