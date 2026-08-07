import { ArrowRight, Camera } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useInvestigation } from "./context";
import { DRAWER_TIMELINE } from "./data";
import { healthRail, StatusPill } from "./primitives";

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
      <SheetContent side="right" className="flex w-full flex-col border-border bg-background p-0 sm:max-w-[560px]">
        {drawer && (
          <>
            <SheetHeader className="border-b border-border px-6 py-5">
              <div className="flex items-center gap-2">
                <span className="label-eyebrow">{drawer.kind}</span>
                <StatusPill health={drawer.health}>
                  {drawer.health === "ok" ? "Healthy" : drawer.health === "warn" ? "Degrading" : "Critical"}
                </StatusPill>
              </div>
              <SheetTitle className="text-lg">{drawer.title}</SheetTitle>
              <SheetDescription>{drawer.subtitle}</SheetDescription>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="px-6 py-5">
                <dl className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
                  {drawer.facts.map((fact) => (
                    <div key={fact.label} className="min-w-0">
                      <dt className="label-eyebrow">{fact.label}</dt>
                      <dd className="mt-1 text-sm leading-5">{fact.value}</dd>
                    </div>
                  ))}
                </dl>

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
                    <p className="mt-3 text-xs text-muted-foreground">Three site photos attached by the responder.</p>
                  </TabsContent>

                  <TabsContent value="Recommendation" className="mt-5">
                    <div className="rounded-xl border border-primary/30 bg-info-soft/50 p-4">
                      <p className="text-sm font-semibold">Schedule a preventive electrical inspection</p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Three failures in nine days on the same circuit. Inspecting now avoids an estimated ₹18,000 in
                        reactive repairs and protects four SLA clocks.
                      </p>
                      <p className="num mt-2 text-xs text-muted-foreground">94% confidence</p>
                    </div>
                  </TabsContent>

                  {TABS.filter((t) => !["Timeline", "Photos", "Recommendation"].includes(t)).map((t) => (
                    <TabsContent key={t} value={t} className="mt-5">
                      <div className="rounded-xl border border-border bg-card p-4">
                        <p className="text-sm font-medium">{t} history</p>
                        <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                          Records for {drawer.title} appear here, newest first, each row ending in the action taken.
                        </p>
                        <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                          <li className="flex justify-between gap-3 border-t border-border pt-2">
                            <span>02 Aug · logged by R. Kulkarni</span>
                            <span>Closed</span>
                          </li>
                          <li className="flex justify-between gap-3 border-t border-border pt-2">
                            <span>27 Jul · logged by A. Jadhav</span>
                            <span>Closed</span>
                          </li>
                        </ul>
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </ScrollArea>

            <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-4">
              <Button size="sm">Assign and schedule</Button>
              <Button
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={() => {
                  narrow({});
                  closeDrawer();
                }}
              >
                Investigate further
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
