import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Camera, User, FileText, Calendar, Clock, MapPin, Tag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useInvestigation } from "./context";
import { DRAWER_TIMELINE } from "./data";
import { healthRail, StatusPill } from "./primitives";
import { fetchDrillDown } from "../../services/inchargeApi";

const TABS = [
  "Timeline",
  "Complaints",
  "Maintenance",
  "Inspections",
  "Staff",
  "Feedback",
  "Photos",
  "Assets",
  "Recommendation",
];

export function InvestigationDrawer() {
  const { drawer, closeDrawer, narrow } = useInvestigation();

  return (
    <Sheet open={Boolean(drawer)} onOpenChange={(o) => !o && closeDrawer()}>
      <SheetContent side="right" className="flex w-full flex-col border-border bg-background p-0 sm:max-w-[580px]">
        {drawer && (
          <>
            <SheetHeader className="border-b border-border px-6 py-5">
              <div className="flex items-center gap-2">
                <span className="label-eyebrow">{drawer.kind}</span>
                <StatusPill health={drawer.health}>
                  {drawer.health === "ok" ? "Healthy / Resolved" : drawer.health === "warn" ? "Degrading / Pending" : "Critical / SLA Breach"}
                </StatusPill>
              </div>
              <SheetTitle className="text-lg font-extrabold">{drawer.title}</SheetTitle>
              <SheetDescription className="text-xs">{drawer.subtitle}</SheetDescription>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="px-6 py-5 space-y-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Comprehensive A to Z Information</h4>
                  <dl className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2">
                    {drawer.facts.map((fact) => (
                      <div key={fact.label} className={cn("min-w-0", fact.label.includes("Description") && "sm:col-span-2")}>
                        <dt className="label-eyebrow font-extrabold text-muted-foreground">{fact.label}</dt>
                        <dd className="mt-1 text-sm font-semibold leading-relaxed text-foreground">{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <Tabs defaultValue="Timeline" className="mt-6">
                  <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
                    {TABS.map((t) => (
                      <TabsTrigger
                        key={t}
                        value={t}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs data-[state=active]:border-primary/50 data-[state=active]:bg-info-soft"
                      >
                        {t}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <TabsContent value="Timeline" className="mt-5">
                    <ol className="space-y-4">
                      {DRAWER_TIMELINE.map((entry) => (
                        <li key={entry.time} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                          <span className="mt-1.5 flex flex-col items-center">
                            <span className={cn("h-2 w-2 rounded-full", healthRail[entry.tone])} aria-hidden />
                            <span className="mt-1 w-px flex-1 bg-border" aria-hidden />
                          </span>
                          <span className="min-w-0 pb-1">
                            <span className="block text-[0.6875rem] text-muted-foreground">{entry.time}</span>
                            <span className="block text-sm leading-5">{entry.text}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </TabsContent>

                  <TabsContent value="Photos" className="mt-5">
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="grid aspect-square place-items-center rounded-lg border border-border bg-secondary text-muted-foreground"
                        >
                          <Camera className="h-4 w-4" aria-hidden />
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">Photos attached by student/responder.</p>
                  </TabsContent>

                  <TabsContent value="Recommendation" className="mt-5">
                    <div className="rounded-xl border border-primary/30 bg-info-soft/50 p-4">
                      <p className="text-sm font-semibold">Operational Action Plan</p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Review complaint history and dispatch dedicated technician to prevent repeated SLA breaches.
                      </p>
                    </div>
                  </TabsContent>

                  {TABS.filter((t) => !["Timeline", "Photos", "Recommendation"].includes(t)).map((t) => (
                    <TabsContent key={t} value={t} className="mt-5">
                      <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-sm font-medium">{t} history</p>
                        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                          Records for {drawer.title} appear here, newest first.
                        </p>
                        <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                          <li className="flex justify-between gap-3 border-t border-border pt-2">
                            <span>Logged by system / student</span>
                            <span>Recorded</span>
                          </li>
                        </ul>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </ScrollArea>

            <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-4">
              <Button size="sm" onClick={closeDrawer}>Close Investigation</Button>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={() => {
                  narrow({});
                  closeDrawer();
                }}
              >
                Reset Filters
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function DrilldownListSheet() {
  const { drilldownList, closeDrilldownList, openDrawer } = useInvestigation();

  const { data: complaints, isLoading } = useQuery({
    queryKey: ['drillDownModal', drilldownList?.filter],
    queryFn: () => fetchDrillDown(drilldownList?.filter || {}),
    enabled: Boolean(drilldownList)
  });

  if (!drilldownList) return null;

  return (
    <Sheet open={Boolean(drilldownList)} onOpenChange={(o) => !o && closeDrilldownList()}>
      <SheetContent side="right" className="flex w-full flex-col border-border bg-background p-0 sm:max-w-[580px]">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="text-lg font-extrabold">{drilldownList.title}</SheetTitle>
          <SheetDescription className="text-xs">
            {drilldownList.subtitle || `${complaints?.length || 0} matching complaint records found`}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-6 py-5">
          {isLoading ? (
            <div className="space-y-3 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-card rounded-2xl border border-border" />
              ))}
            </div>
          ) : !complaints || complaints.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No matching complaint records found for this filter.
            </div>
          ) : (
            <div className="space-y-3">
              {complaints.map((c: any) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    openDrawer({
                      kind: "Complaint",
                      title: `Complaint #${String(c.id).slice(-6)} · ${c.category}`,
                      subtitle: `${c.studentName} (PRN: ${c.prn || c.rollNumber}) · Room ${c.room}`,
                      health: c.hoursElapsed > 48 ? "crit" : c.status === "Resolved" ? "ok" : "warn",
                      facts: [
                        { label: "Student Name", value: c.studentName },
                        { label: "Student PRN", value: c.prn || c.rollNumber },
                        { label: "Room Number", value: `Room ${c.room}` },
                        { label: "Branch & Year", value: `${c.branch} · ${c.year}` },
                        { label: "Category", value: c.category },
                        { label: "Status", value: c.status },
                        { label: "Hours Elapsed", value: `${c.hoursElapsed}h (${c.hoursElapsed > 48 ? 'Overdue / SLA Breach' : 'Within SLA'})` },
                        { label: "Assigned Staff", value: c.assignedTo },
                        { label: "Created Date", value: new Date(c.createdAt).toLocaleString() },
                        { label: "Resolved Date", value: c.resolvedAt ? new Date(c.resolvedAt).toLocaleString() : "Not resolved" },
                        { label: "Full Description", value: c.description || "No description provided." }
                      ]
                    });
                  }}
                  className="w-full rounded-2xl border border-border bg-card p-4 text-left transition-all duration-150 hover:border-primary/50 hover:shadow-soft"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-primary">{c.category} · Room {c.room}</span>
                    <StatusPill health={c.hoursElapsed > 48 ? "crit" : c.status === "Resolved" ? "ok" : "warn"}>
                      {c.status}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-sm font-bold text-foreground line-clamp-2">{c.description || "No description provided."}</p>
                  <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-2.5">
                    <span>Student: <strong className="text-foreground">{c.studentName}</strong> (PRN: <span className="font-mono">{c.prn || c.rollNumber}</span>)</span>
                    <span>Assigned: <strong className="text-foreground">{c.assignedTo}</strong></span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
