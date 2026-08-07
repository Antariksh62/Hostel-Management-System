import { CheckCircle2, Gauge, Search, Sparkles, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInvestigation } from "./context";
import { RECOMMENDATIONS } from "./data";
import { healthSoft } from "./primitives";

const urgencyHealth = { Critical: "crit", High: "warn", Medium: "ok" } as const;

export function MissionControl() {
  const { jumpToEvidence, decided, decide } = useInvestigation();
  const open = RECOMMENDATIONS.filter((r) => !decided.includes(r.id));
  const closed = RECOMMENDATIONS.filter((r) => decided.includes(r.id));

  return (
    <aside
      id="band-mission"
      aria-labelledby="mission-title"
      className="scroll-mt-32 rounded-2xl border border-border bg-surface-raised p-5 shadow-lift xl:sticky xl:top-[152px]"
    >
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="mission-title" className="text-sm font-semibold">
            Mission control
          </h2>
          <p className="text-[0.6875rem] text-muted-foreground">
            {open.length} decisions waiting · {closed.length} decided today
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        What should I do next? Each recommendation carries its reason, its evidence and the cost of doing nothing.
      </p>

      <ul className="mt-5 space-y-4">
        {open.slice(0, 3).map((rec) => (
          <li
            key={rec.id}
            className="rounded-xl border border-border bg-card p-4 transition-colors duration-150 hover:border-border-strong"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 text-[0.9375rem] font-semibold leading-5">{rec.title}</h3>
              <span
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-medium",
                  healthSoft[urgencyHealth[rec.urgency]],
                )}
              >
                {rec.urgency}
              </span>
            </div>

            <p className="mt-2 text-xs leading-5 text-muted-foreground">{rec.why}</p>

            <p className="label-eyebrow mt-3.5">Evidence</p>
            <ul className="mt-1.5 space-y-1">
              {rec.evidence.map((e) => (
                <li key={e} className="flex gap-2 text-xs leading-5 text-foreground/85">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
                  {e}
                </li>
              ))}
            </ul>

            <dl className="mt-3.5 space-y-2 border-t border-border pt-3.5 text-xs">
              <div className="flex items-center gap-2">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5" aria-hidden /> Confidence
                </dt>
                <dd className="num ml-auto flex items-center gap-2">
                  <span className="block h-1.5 w-16 rounded-full bg-secondary">
                    <span className="block h-1.5 rounded-full bg-primary" style={{ width: `${rec.confidence}%` }} />
                  </span>
                  {rec.confidence}%
                </dd>
              </div>
              <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">Impact</dt>
                <dd>{rec.impact}</dd>
              </div>
              <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">If ignored</dt>
                <dd className="num text-crit-foreground">{rec.money}</dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" className="gap-1.5" onClick={() => decide(rec.id)}>
                <Zap className="h-3.5 w-3.5" aria-hidden /> {rec.action}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={() => jumpToEvidence(rec.evidenceTarget, rec.scope)}
              >
                <Search className="h-3.5 w-3.5" aria-hidden /> See evidence
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {open.length > 3 && (
        <p className="mt-4 text-xs text-muted-foreground">
          {open.length - 3} further recommendations held back until these are decided.
        </p>
      )}

      {closed.length > 0 && (
        <div className="mt-6 border-t border-border pt-5">
          <p className="label-eyebrow">Decided today</p>
          <ul className="mt-2.5 space-y-2">
            {closed.map((rec) => (
              <li
                key={rec.id}
                className="flex items-start gap-2 rounded-lg bg-ok-soft px-3 py-2 text-xs animate-in fade-in slide-in-from-bottom-1 duration-200"
              >
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok-foreground" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium">{rec.title}</span>
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
