import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";
import { useInvestigation } from "./context";
import { ActionLine, Band, DeltaChip, healthRail, Panel } from "./primitives";
import { useComplaints } from "./useHoidssData";

const axis = { fontSize: 11, fill: "var(--muted-foreground)" } as const;

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

export function ComplaintsBand() {
  const { scope, narrow, openDrilldownList } = useInvestigation();
  const { data, isLoading } = useComplaints();
  const focus = scope.category;

  if (isLoading || !data) {
    return (
      <section className="scroll-mt-32 animate-pulse opacity-50">
        <div className="h-12 w-1/3 bg-card rounded-md mb-8"></div>
        <div className="h-[400px] bg-card rounded-3xl border border-border"></div>
      </section>
    );
  }

  const { CATEGORIES, COMPLAINT_TREND, AGING, REPEAT_STATS, verdict } = data;

  return (
    <Band
      id="complaints"
      question="What keeps breaking?"
      verdict={verdict}
      aside={null}
      detailLabel="Show complaint detail"
      detailSummary="Repeat complaint statistics"
      detail={<ComplaintDetail REPEAT_STATS={REPEAT_STATS} />}
    >
      <div className="grid gap-8 xl:gap-10 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)_minmax(0,0.8fr)]">
        <Panel title="Top categories" subtitle="Open complaints · select to investigate">
          <ul className="space-y-1">
            {CATEGORIES.map((cat: any) => {
              const active = focus === cat.name;
              return (
                <li key={cat.name}>
                  <button
                    type="button"
                    onClick={() => {
                      openDrilldownList({
                        title: `${cat.name} Complaints`,
                        subtitle: `${cat.count} complaints recorded in this category`,
                        filter: { category: cat.name }
                      });
                    }}
                    className={cn(
                      "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      active && "bg-info-soft",
                    )}
                    aria-pressed={active}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm">
                        <span className={cn("h-1.5 w-1.5 rounded-full", healthRail[cat.health])} aria-hidden />
                        <span className="truncate">{cat.name}</span>
                      </span>
                      <span className="mt-1.5 block h-1 rounded-full bg-secondary">
                        <span
                          className={cn("block h-1 rounded-full", healthRail[cat.health])}
                          style={{ width: `${(cat.count / 24) * 100}%` }}
                        />
                      </span>
                    </span>
                    <span className="num shrink-0 text-right">
                      <span className="block text-sm font-medium">{cat.count}</span>
                      <span className="block text-[0.6875rem] text-muted-foreground">{cat.growth}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => {
              openDrilldownList({
                title: "All Categories Complaints",
                subtitle: "Complaint records across all categories",
                filter: {}
              });
            }}
            className="w-full text-left"
          >
            <ActionLine text="Select a category to filter" />
          </button>
        </Panel>

        <Panel title="Complaint frequency" subtitle="All complaints vs electrical · last 14 days">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={COMPLAINT_TREND} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="allFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={axis} />
                <YAxis tickLine={false} axisLine={false} tick={axis} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area dataKey="all" stroke="var(--chart-5)" strokeWidth={1.5} fill="url(#allFill)" name="All" />
                <Line dataKey="electrical" stroke="var(--chart-4)" strokeWidth={2} dot={false} name="Electrical" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ActionLine text="Complaint volume trend over time" />
        </Panel>

        <Panel title="Complaint aging" subtitle="Open complaints by age">
          <ul className="space-y-3">
            {AGING.map((bucket: any) => (
              <li key={bucket.bucket} className="grid grid-cols-[4.5rem_minmax(0,1fr)_2rem] items-center gap-3">
                <span className="text-xs text-muted-foreground">{bucket.bucket}</span>
                <span className="block h-2 rounded-full bg-secondary">
                  <span
                    className={cn("block h-2 rounded-full", healthRail[bucket.health])}
                    style={{ width: `${(bucket.count / 21) * 100}%` }}
                  />
                </span>
                <span className="num text-right text-sm">{bucket.count}</span>
              </li>
            ))}
          </ul>
          <ActionLine text="Complaints exceeding 48 hours breach SLA" />
        </Panel>
      </div>
    </Band>
  );
}

function ComplaintDetail({ REPEAT_STATS }: { REPEAT_STATS: any[] }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        {REPEAT_STATS.map((stat: any) => (
          <Panel key={stat.label}>
            <p className="label-eyebrow">{stat.label}</p>
            <p className="num mt-2 text-3xl font-semibold">{stat.value}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{stat.note}</p>
          </Panel>
        ))}
      </div>

      {/* Additional detailed charts have been removed to avoid displaying fake data */}
    </div>
  );
}
