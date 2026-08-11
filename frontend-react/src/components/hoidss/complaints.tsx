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
import { AGING, CATEGORIES, COMPLAINT_TREND, PEAK_HOURS, REPEAT_STATS, RESOLUTION, SEASONAL, SEVERITY } from "./data";
import { ActionLine, Band, DeltaChip, healthRail, Panel } from "./primitives";

const axis = { fontSize: 11, fill: "var(--muted-foreground)" } as const;

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

export function ComplaintsBand() {
  const { scope, narrow } = useInvestigation();
  const focus = scope.category;

  return (
    <Band
      id="complaints"
      question="What keeps breaking?"
      verdict={
        focus
          ? `${focus} is the story: it is growing while every other category is flat or falling, and its median resolution time is more than twice the hostel median.`
          : "Electrical is the story: 24 open complaints, up 62% in 14 days, while water, internet and housekeeping are flat or improving."
      }
      aside={<DeltaChip delta="+11 open vs last week" dir="up" />}
      detailLabel="Show complaint detail"
      detailSummary="Severity split, repeat and reopened rates, seasonality, peak hours, resolution spread"
      detail={<ComplaintDetail />}
    >
      <div className="grid gap-8 xl:gap-10 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)_minmax(0,0.8fr)]">
        <Panel title="Top categories" subtitle="Open complaints · select to investigate">
          <ul className="space-y-1">
            {CATEGORIES.map((cat) => {
              const active = focus === cat.name;
              return (
                <li key={cat.name}>
                  <button
                    type="button"
                    onClick={() => narrow({ category: cat.name })}
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
          <ActionLine text="Electrical accounts for 38% of the queue — cap new intake with a preventive sweep" />
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
          <ActionLine text="Electrical growth is the entire trend — the other categories need no intervention" />
        </Panel>

        <Panel title="Complaint aging" subtitle="Open complaints by age">
          <ul className="space-y-3">
            {AGING.map((bucket) => (
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
          <ActionLine text="Four complaints have aged past seven days — escalate them to the warden review" />
        </Panel>
      </div>
    </Band>
  );
}

function ComplaintDetail() {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        {REPEAT_STATS.map((stat) => (
          <Panel key={stat.label}>
            <p className="label-eyebrow">{stat.label}</p>
            <p className="num mt-2 text-3xl font-semibold">{stat.value}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{stat.note}</p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
        <Panel title="Severity split" subtitle="Open complaints">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={SEVERITY} dataKey="value" nameKey="name" innerRadius={38} outerRadius={62} paddingAngle={2}>
                  {["var(--chart-4)", "var(--chart-3)", "var(--chart-1)", "var(--chart-5)"].map((c, i) => (
                    <Cell key={i} fill={c} stroke="var(--card)" />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {SEVERITY.map((s) => (
              <li key={s.name} className="flex justify-between">
                <span>{s.name}</span>
                <span className="num">{s.value}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Peak complaint hours" subtitle="Reports by hour of day">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={PEAK_HOURS} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={axis} />
                <YAxis tickLine={false} axisLine={false} tick={axis} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="var(--chart-1)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ActionLine text="Staff the 18:00–22:00 window with one additional responder" />
        </Panel>

        <Panel title="Seasonal comparison" subtitle="This year vs last year">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={SEASONAL} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axis} />
                <YAxis tickLine={false} axisLine={false} tick={axis} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line dataKey="lastYear" stroke="var(--chart-5)" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                <Line dataKey="thisYear" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ActionLine text="August runs 30% above last year — front-load the monsoon maintenance budget" />
        </Panel>

        <Panel title="Resolution spread" subtitle="Closed complaints by time to close">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={RESOLUTION} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="band" tickLine={false} axisLine={false} width={54} tick={axis} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="var(--chart-2)" barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ActionLine text="Six complaints took over three days — all electrical, all one owner" />
        </Panel>
      </div>
    </div>
  );
}
