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

      <div className="mt-10 grid gap-8 sm:grid-cols-2 xl:grid-cols-3 lg:gap-10">
        {SIGNALS.map((signal) => (
          <article
            key={signal.id}
            className={cn(
              "group flex flex-col justify-between rounded-3xl border border-border bg-card p-8 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift lg:p-10 min-h-[300px]",
              signal.health === "crit" && "border-crit/50 bg-crit-soft/10",
              signal.health === "warn" && "border-warn/40 bg-warn-soft/10",
            )}
          >
            <div>
              <div className="flex items-center justify-between gap-4 mb-6">
                <p className="label-eyebrow min-w-0 truncate tracking-widest font-extrabold text-foreground/80">{signal.label}</p>
                {signal.health === "ok" ? (
                  <StatusPill health="ok">On target</StatusPill>
                ) : (
                  <StatusPill health={signal.health}>{signal.health === "crit" ? "Needs action" : "Watch"}</StatusPill>
                )}
              </div>

              <div className="mt-4 flex items-baseline justify-between gap-4">
                <span className={cn("num text-5xl sm:text-6xl font-extrabold leading-none tracking-tight", healthText[signal.health])}>
                  {signal.value}
                </span>
                <DeltaChip delta={signal.delta} dir={signal.deltaDir} />
              </div>

              <div className="mt-7 -mx-1">
                <Sparkline data={signal.series} health={signal.health} />
              </div>

              <p className="mt-6 text-base leading-relaxed text-muted-foreground font-normal">{signal.consequence}</p>
            </div>

            <div className="mt-8 flex items-center justify-between gap-4 border-t border-border/70 pt-6">
              {signal.action ? (
                <button
                  type="button"
                  onClick={() => narrow(signal.scope ?? {})}
                  className="inline-flex items-center gap-2 text-sm font-extrabold text-primary transition-all duration-150 hover:gap-3 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {signal.action}
                  <ArrowRight className="h-4.5 w-4.5" aria-hidden />
                </button>
              ) : (
                <span className="text-xs font-semibold text-muted-foreground">No action needed today</span>
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
                className="text-xs sm:text-sm font-bold text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
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
