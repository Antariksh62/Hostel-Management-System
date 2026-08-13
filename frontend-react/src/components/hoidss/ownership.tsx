import { AlertTriangle, ArrowUpRight, Clock, ShieldAlert, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useInvestigation } from "./context";
import { type QueueItem } from "./data";
import { ActionLine, Band, healthRail, healthSoft, Panel, StatusPill } from "./primitives";
import { useOwnership } from "./useHoidssData";

const KINDS: QueueItem["kind"][] = [
  "Emergency",
  "SLA breach",
  "Inspection",
  "Maintenance",
  "Housekeeping",
  "Escalation",
];

export function OwnershipBand() {
  const { scope, narrow, openDrawer } = useInvestigation();
  const [kind, setKind] = useState<QueueItem["kind"] | null>(null);
  const { data, isLoading } = useOwnership();
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(
    () =>
      (data?.QUEUE || []).filter(
        (item: QueueItem) =>
          (!kind || item.kind === kind) &&
          (!scope.block || item.block === scope.block) &&
          (!scope.category || item.category === scope.category),
      ),
    [kind, scope.block, scope.category],
  );

  const visible = showAll ? filtered : filtered.slice(0, 5);
  const hidden = filtered.length - visible.length;

  if (isLoading || !data) {
    return (
      <section className="scroll-mt-32 animate-pulse opacity-50">
        <div className="h-12 w-1/3 bg-card rounded-md mb-8"></div>
        <div className="h-[400px] bg-card rounded-3xl border border-border"></div>
      </section>
    );
  }

  const { QUEUE, STAFF, verdict } = data;

  return (
    <Band
      id="ownership"
      question="Who owns the problem?"
      verdict={verdict}
      aside={
        <div className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(kind === k ? null : k)}
              aria-pressed={kind === k}
              className={cn(
                "rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                kind === k && "border-primary/50 bg-info-soft text-foreground",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      }
      detailLabel="Show who has capacity"
      detailSummary="Workload, availability, response and resolution times, leaderboard"
      detail={<StaffDetail STAFF={STAFF} />}
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <ul className="divide-y divide-border">
          {visible.map((item) => (
            <li key={item.id} className="group">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-5 px-5 py-4 transition-colors duration-150 hover:bg-secondary/50 sm:px-6 lg:px-7 lg:py-5">
                <span className={cn("h-10 w-1 shrink-0 rounded-full", healthRail[item.severity])} aria-hidden />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-md px-1.5 py-0.5 text-[0.6875rem] font-medium", healthSoft[item.severity])}>
                      {item.kind}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        openDrawer({
                          kind: "Alert",
                          title: item.title,
                          subtitle: `${item.location} · ${item.kind}`,
                          health: item.severity,
                          facts: [
                            { label: "Owner", value: item.owner ?? "Unassigned" },
                            { label: "Age", value: item.age },
                            { label: "SLA", value: item.slaIn },
                            { label: "Category", value: item.category },
                          ],
                        })
                      }
                      className="min-w-0 truncate text-left text-sm font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {item.title}
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => narrow({ block: item.block, category: item.category })}
                      className="rounded hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {item.location}
                    </button>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden /> {item.age}
                    </span>
                    <span className={item.slaIn.startsWith("Breached") ? "text-crit-foreground" : undefined}>
                      {item.slaIn}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {item.owner ? (
                    <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary text-[0.625rem] font-semibold text-foreground">
                        {item.owner.split(" ").map((p) => p[0]).join("")}
                      </span>
                      {item.owner}
                    </span>
                  ) : (
                    <StatusPill health="crit">Unowned</StatusPill>
                  )}
                  <div className="hidden gap-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100 lg:flex">
                    <Button size="sm" variant="secondary" className="h-8 gap-1.5">
                      <UserPlus className="h-3.5 w-3.5" aria-hidden /> Assign
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 gap-1.5">
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /> Escalate
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
          <span className="text-xs text-muted-foreground">
            {filtered.length} items in the ownership queue
            {hidden > 0 ? ` · ${hidden} hidden to keep this readable` : ""}
          </span>
          {filtered.length > 5 && (
            <Button size="sm" variant="ghost" onClick={() => setShowAll((s) => !s)}>
              {showAll ? "Show top 5 only" : "Open full queue"}
            </Button>
          )}
        </div>
      </div>

    </Band>
  );
}

function StaffDetail({ STAFF }: { STAFF: any[] }) {
  const { narrow, openDrawer } = useInvestigation();

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Panel title="Workload" subtitle="Percentage of a normal day">
        <ul className="space-y-3.5">
          {STAFF.map((s: any) => (
            <li key={s.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm">{s.name}</span>
                  <span className="num text-xs text-muted-foreground">{s.load}%</span>
                </div>
                <span className="mt-1.5 block h-2 rounded-full bg-secondary">
                  <span
                    className={cn("block h-2 rounded-full", healthRail[s.health])}
                    style={{ width: `${Math.min(100, (s.load / 150) * 100)}%` }}
                  />
                </span>
              </div>
              <span className="shrink-0 text-[0.6875rem] text-muted-foreground">{s.availability}</span>
            </li>
          ))}
        </ul>
        <ActionLine text="Workload is calculated relative to the team's busiest member" />
      </Panel>

      <Panel title="Staff leaderboard" subtitle="Response, resolution and SLA compliance">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Staff</TableHead>
                <TableHead className="text-right">Open</TableHead>
                <TableHead className="text-right">Response</TableHead>
                <TableHead className="text-right">Resolution</TableHead>
                <TableHead className="text-right">SLA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {STAFF.map((s: any) => (
                <TableRow
                  key={s.name}
                  className="cursor-pointer"
                  onClick={() => {
                    narrow({ staff: s.name });
                    openDrawer({
                      kind: "Staff",
                      title: s.name,
                      subtitle: `${s.role} · ${s.availability}`,
                      health: s.health,
                      facts: [
                        { label: "Workload", value: `${s.load}% of a normal day` },
                        { label: "Open jobs", value: String(s.open) },
                        { label: "Median response", value: s.response },
                        { label: "Median resolution", value: s.resolution },
                        { label: "SLA compliance", value: `${s.sla}%` },
                      ],
                    });
                  }}
                >
                  <TableCell>
                    <span className="block text-sm font-medium">{s.name}</span>
                    <span className="block text-[0.6875rem] text-muted-foreground">{s.role}</span>
                  </TableCell>
                  <TableCell className="num text-right">{s.open}</TableCell>
                  <TableCell className="num text-right">{s.response}</TableCell>
                  <TableCell className="num text-right">{s.resolution}</TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        "num rounded-md px-1.5 py-0.5 text-xs",
                        healthSoft[s.sla >= 90 ? "ok" : s.sla >= 80 ? "warn" : "crit"],
                      )}
                    >
                      {s.sla}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ActionLine text="Maintain SLA compliance above 80%" />
      </Panel>
    </div>
  );
}
