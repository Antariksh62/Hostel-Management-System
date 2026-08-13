import { ChevronRight, Layers } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { useInvestigation } from "./context";
import { type Block } from "./data";
import { ActionLine, Band, Panel } from "./primitives";
import { useHeatmap } from "./useHoidssData";

function heatClass(score: number) {
  if (score >= 80) return "bg-heat-1";
  if (score >= 65) return "bg-heat-2";
  if (score >= 45) return "bg-heat-3";
  return "bg-heat-4";
}

function heatLabel(score: number) {
  if (score >= 80) return "Healthy";
  if (score >= 65) return "Minor issues";
  if (score >= 45) return "Degrading";
  return "Critical";
}

export function HeatmapBand() {
  const { scope, narrow, openDrawer } = useInvestigation();
  const { data, isLoading } = useHeatmap();
  const [level, setLevel] = useState<"blocks" | "floors" | "rooms">("blocks");
  const [activeBlock, setActiveBlock] = useState<Block | null>(null);
  const [activeFloor, setActiveFloor] = useState<string | null>(null);

  const scopedBlock = useMemo(
    () => (data?.BLOCKS || []).find((b: Block) => b.name === scope.block) ?? null,
    [scope.block, data?.BLOCKS],
  );
  const block = activeBlock ?? scopedBlock;
  const floor = block?.floors.find((f: any) => f.id === activeFloor) ?? block?.floors[0] ?? null;
  const dimmed = (name: string) => Boolean(scope.block && scope.block !== name);

  const effectiveLevel =
    level === "blocks" && scopedBlock
      ? "floors"
      : level === "rooms" && (!block || !floor)
      ? "blocks"
      : level;

  if (isLoading || !data) {
    return (
      <section className="scroll-mt-32 animate-pulse opacity-50">
        <div className="h-12 w-1/3 bg-card rounded-md mb-8"></div>
        <div className="h-[500px] bg-card rounded-3xl border border-border"></div>
      </section>
    );
  }

  const { BLOCKS, PROBLEM_ROOMS } = data;

  // Find the block/floor with lowest score to put in the verdict
  const worstBlock = [...BLOCKS].sort((a, b) => a.score - b.score)[0];
  const worstName = worstBlock ? worstBlock.name : "No active issues";

  return (
    <Band
      id="heatmap"
      question="Where is it happening?"
      verdict={
        scope.block
          ? `${scope.block} is the current focus area. Review the red rooms to see open complaints.`
          : `${worstName} has the highest concentration of complaints.`
      }
      aside={
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          Composite operational health
        </div>
      }
      detailLabel="Show space comparison"
      detailSummary="Floor comparison and rooms with recurring complaints"
      detail={<SpaceComparison BLOCKS={BLOCKS} PROBLEM_ROOMS={PROBLEM_ROOMS} />}
    >
      <div className="rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-7">
        {/* Breadcrumb drilldown */}
        <nav aria-label="Heatmap level" className="flex flex-wrap items-center gap-1.5 text-sm">
          <button
            type="button"
            onClick={() => {
              setLevel("blocks");
              setActiveBlock(null);
              setActiveFloor(null);
            }}
            className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            Hostel
          </button>
          {block && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <button
                type="button"
                onClick={() => {
                  setLevel("floors");
                  setActiveFloor(null);
                }}
                className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {block.name}
              </button>
            </>
          )}
          {effectiveLevel === "rooms" && floor && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              <span className="rounded-md px-2 py-1 font-medium">{floor.name}</span>
            </>
          )}
          <span className="ml-auto hidden text-[0.6875rem] text-muted-foreground sm:block">
            Arrow keys move between cells · Enter opens the investigation
          </span>
        </nav>

        <div className="mt-6 min-h-[380px] animate-in fade-in duration-200">
          {effectiveLevel === "blocks" && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {BLOCKS.map((b: Block) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setActiveBlock(b);
                    setLevel("rooms");
                    setActiveFloor(b.floors[0]?.id || null);
                    narrow({ block: b.name });
                  }}
                  className={cn(
                    "group rounded-xl border border-border bg-surface p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    dimmed(b.name) && "opacity-40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{b.name}</span>
                    <span className={cn("h-2.5 w-2.5 rounded-full", heatClass(b.score))} aria-hidden />
                  </div>
                  <p className="num mt-4 text-3xl font-semibold">{b.score}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{heatLabel(b.score)}</p>
                  <div className="mt-4 grid grid-cols-4 gap-1.5" aria-hidden>
                    {b.floors.map((f) => (
                      <span key={f.id} className={cn("h-1.5 rounded-full", heatClass(f.score))} />
                    ))}
                  </div>
                  <p className="mt-3 text-[0.6875rem] text-muted-foreground">
                    {b.floors.length} floors · {b.floors.length * 12} rooms
                  </p>
                </button>
              ))}
            </div>
          )}

          {effectiveLevel === "floors" && block && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {block.floors.map((f: any) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setActiveFloor(f.id);
                    setLevel("rooms");
                    narrow({ block: block.name, floor: f.name });
                  }}
                  className="group rounded-xl border border-border bg-surface p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{f.name}</span>
                    <span className={cn("h-2.5 w-2.5 rounded-full", heatClass(f.score))} aria-hidden />
                  </div>
                  <p className="num mt-4 text-3xl font-semibold">{f.score}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{heatLabel(f.score)}</p>
                  <div className="mt-4 grid grid-cols-6 gap-1.5" aria-hidden>
                    {f.rooms.map((r: any) => (
                      <span key={r.id} className={cn("h-3 rounded-sm", heatClass(r.score))} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}

          {effectiveLevel === "rooms" && floor && block && (
            <div>
              <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6 lg:grid-cols-10">
                {floor.rooms.map((room: any) => (
                  <HoverCard key={room.id} openDelay={80}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          narrow({ block: block.name, floor: floor.name, room: room.id });
                          openDrawer({
                            kind: "Room",
                            title: `Room ${room.id}`,
                            subtitle: `${block.name} · ${floor.name} · ${heatLabel(room.score)}`,
                            health: room.score >= 65 ? "ok" : room.score >= 45 ? "warn" : "crit",
                            facts: [
                              { label: "Open complaints", value: String(room.complaints) },
                              { label: "Complaint types", value: room.types.join(", ") || "None" },
                              { label: "Occupant", value: room.occupant },
                              { label: "Inspection score", value: `${room.inspection}/100` },
                              { label: "Infrastructure health", value: `${room.infra}/100` },
                              { label: "Estimated maintenance cost", value: room.cost },
                              { label: "Last repair", value: room.lastRepair },
                            ],
                          });
                        }}
                        className={cn(
                          "group relative aspect-square rounded-lg text-left transition-all duration-150 hover:scale-[1.06] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          heatClass(room.score),
                          scope.room && scope.room !== room.id && "opacity-40",
                        )}
                        aria-label={`Room ${room.id}, ${heatLabel(room.score)}, ${room.complaints} open complaints`}
                      >
                        <span className="num absolute inset-x-0 bottom-1.5 text-center text-[0.625rem] font-medium text-background/90 mix-blend-luminosity">
                          {String(room.id).includes("-") ? String(room.id).split("-")[1] : String(room.id)}
                        </span>
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-72 border-border bg-popover">
                      <p className="text-sm font-semibold">Room {room.id}</p>
                      <p className="label-eyebrow mt-0.5">{heatLabel(room.score)} · health {room.score}</p>
                      <dl className="mt-3 space-y-1.5 text-xs">
                        {[
                          ["Complaints", String(room.complaints)],
                          ["Types", room.types.join(", ") || "None"],
                          ["Occupant", room.occupant],
                          ["Inspection", `${room.inspection}/100`],
                          ["Infrastructure", `${room.infra}/100`],
                          ["Est. cost", room.cost],
                          ["Last repair", room.lastRepair],
                        ].map(([k, v]) => (
                          <div key={k} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
                            <dt className="text-muted-foreground">{k}</dt>
                            <dd className="min-w-0 truncate">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </HoverCardContent>
                  </HoverCard>
                ))}
              </div>
              <ActionLine text={`Open the worst room on ${floor.name} and assign an electrician`} />
            </div>
          )}
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-border pt-5">
          <span className="label-eyebrow">Health scale</span>
          <div className="flex items-center gap-2">
            {[
              ["bg-heat-1", "Healthy"],
              ["bg-heat-2", "Minor"],
              ["bg-heat-3", "Degrading"],
              ["bg-heat-4", "Critical"],
            ].map(([cls, label]) => (
              <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("h-3 w-6 rounded-sm", cls)} aria-hidden />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Band>
  );
}

function SpaceComparison({ BLOCKS, PROBLEM_ROOMS }: { BLOCKS: Block[], PROBLEM_ROOMS: any[] }) {
  const { narrow } = useInvestigation();
  const blockData = BLOCKS.map((b: Block) => ({ name: b.name, score: b.score }));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Floor comparison" subtitle="Overall health score by floor">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={blockData} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <Bar dataKey="score" radius={[6, 6, 0, 0]} barSize={38}>
                {blockData.map((d: any) => (
                  <Cell
                    key={d.name}
                    fill={d.score >= 80 ? "var(--chart-2)" : d.score >= 65 ? "var(--chart-3)" : "var(--chart-4)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ActionLine text="Lower scores indicate higher complaint concentrations." />
      </Panel>

      <Panel title="Rooms that keep failing" subtitle="Ranked by repeat complaints">
        <ul className="divide-y divide-border">
          {PROBLEM_ROOMS.map((room: any) => (
            <li key={room.room}>
              <button
                type="button"
                onClick={() => narrow({ room: room.room, category: room.category })}
                className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 text-left transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span className={cn("h-8 w-1.5 rounded-full", heatClass(room.score))} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Room {room.room}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {room.complaints} complaints · {room.category}
                  </span>
                </span>
                <span className="num shrink-0 text-sm text-muted-foreground">{room.score}</span>
              </button>
            </li>
          ))}
        </ul>
        <ActionLine text="Rooms with multiple identical issues in the last 30 days" />
      </Panel>
    </div>
  );
}
