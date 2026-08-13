import { CheckCircle2, Gauge, Search, Sparkles, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInvestigation } from "./context";
import { healthSoft } from "./primitives";
import { useMissionControl } from "./useHoidssData";

const urgencyHealth = { Critical: "crit", High: "warn", Medium: "ok" } as const;

export function MissionControl() {
  const { data, isLoading } = useMissionControl();
  const { jumpToEvidence, decided, decide } = useInvestigation();
  
  if (isLoading || !data) {
    return (
      <aside className="scroll-mt-36 animate-pulse opacity-50">
        <div className="h-[500px] rounded-3xl border border-border bg-surface-raised p-7 shadow-lift"></div>
      </aside>
    );
  }

  const { RECOMMENDATIONS } = data;
  const open = RECOMMENDATIONS.filter((r: any) => !decided.includes(r.id));
  const closed = RECOMMENDATIONS.filter((r: any) => decided.includes(r.id));

  return (
    <aside
      id="band-mission"
      aria-labelledby="mission-title"
      className="scroll-mt-36 rounded-3xl border border-border bg-surface-raised p-7 shadow-lift sm:p-8 lg:p-10 xl:sticky xl:top-[160px]"
    >
      <div className="flex items-center gap-3.5">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Sparkles className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="mission-title" className="text-lg font-bold">
            Mission control
          </h2>
          <p className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
            {open.length} decisions waiting · {closed.length} decided today
          </p>
        </div>
      </div>

      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
        Rule-based management recommendations generated from current operational data.
      </p>

      <ul className="mt-8 space-y-6">
        {open.slice(0, 3).map((rec: any) => (
          <li
            key={rec.id}
            className="rounded-2xl border border-border bg-card p-6 shadow-soft transition-colors duration-150 hover:border-border-strong lg:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="min-w-0 text-base sm:text-lg font-bold leading-snug">{rec.title}</h3>
              <span
                className={cn(
                  "shrink-0 rounded-lg px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider",
                  healthSoft[urgencyHealth[rec.urgency]],
                )}
              >
                {rec.urgency}
              </span>
            </div>

            <p className="mt-3 text-xs sm:text-sm leading-relaxed text-muted-foreground">{rec.why}</p>

            <p className="label-eyebrow mt-5 font-bold tracking-widest">Evidence</p>
            <ul className="mt-2.5 space-y-2">
              {rec.evidence.map((e: string) => (
                <li key={e} className="flex gap-2.5 text-xs sm:text-sm leading-relaxed text-foreground/90 font-medium">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  {e}
                </li>
              ))}
            </ul>

            <dl className="mt-5 space-y-3 border-t border-border/80 pt-5 text-xs sm:text-sm">
              {/* Confidence scores explicitly removed per requirements */}
              <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground font-medium">Impact</dt>
                <dd className="font-semibold">{rec.impact}</dd>
              </div>
              {rec.money !== "—" && (
                <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
                  <dt className="text-muted-foreground font-medium">If ignored</dt>
                  <dd className="num font-extrabold text-crit-foreground">{rec.money}</dd>
                </div>
              )}
            </dl>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="sm" className="gap-2 px-4 py-2.5 text-xs font-bold" onClick={() => decide(rec.id)}>
                <Zap className="h-4 w-4" aria-hidden /> {rec.action}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="gap-2 px-4 py-2.5 text-xs font-semibold"
                onClick={() => jumpToEvidence(rec.evidenceTarget, rec.scope)}
              >
                <Search className="h-4 w-4" aria-hidden /> See evidence
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {open.length > 3 && (
        <p className="mt-6 text-xs font-medium text-muted-foreground">
          {open.length - 3} further recommendations held back until these are decided.
        </p>
      )}

      {closed.length > 0 && (
        <div className="mt-8 border-t border-border/80 pt-6">
          <p className="label-eyebrow font-bold tracking-widest">Decided today</p>
          <ul className="mt-4 space-y-3">
            {closed.map((rec: any) => (
              <li
                key={rec.id}
                className="flex items-start gap-3 rounded-xl bg-ok-soft px-4 py-3 text-xs sm:text-sm animate-in fade-in slide-in-from-bottom-1 duration-200"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok-foreground" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-bold">{rec.title}</span>
                  <span className="block text-muted-foreground">{rec.action} · approved 07:{10 + closed.indexOf(rec)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
