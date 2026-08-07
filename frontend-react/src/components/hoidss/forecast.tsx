import { ArrowUpRight } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ASSETS, COST_BY_BLOCK, COST_BY_CATEGORY, FORECAST, FORECAST_SERIES, MONTHLY_SPEND } from "./data";
import { ActionLine, Band, Panel } from "./primitives";

const axis = { fontSize: 11, fill: "var(--muted-foreground)" } as const;
const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

export function ForecastBand() {
  return (
    <Band
      id="forecast"
      question="What will become a problem soon?"
      verdict="Three things are already in motion: complaint volume keeps climbing, eleven rooms are on the edge of failure, and August spend is running 24% above the budget line."
      detailLabel="Show maintenance & cost detail"
      detailSummary="Asset failure rates, replacement candidates, spend by block and category, budget utilisation"
      detail={<MaintenanceDetail />}
    >
      <div className="grid gap-5 lg:grid-cols-3">
        {FORECAST.map((f) => (
          <Panel key={f.id}>
            <p className="label-eyebrow">{f.label}</p>
            <p className="num mt-2 text-3xl font-semibold">{f.value}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{f.note}</p>
            <p className="mt-3 rounded-lg bg-crit-soft px-3 py-2 text-xs leading-5 text-crit-foreground">
              If ignored: {f.inaction}
            </p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="num text-[0.6875rem] text-muted-foreground">{f.confidence}% confidence</span>
              <Button size="sm" variant="secondary" className="h-8 gap-1.5">
                Convert to recommendation
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
          </Panel>
        ))}
      </div>

      <div className="mt-5">
        <Panel title="Complaint forecast" subtitle="Projected range · next 8 days">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={FORECAST_SERIES} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={axis} />
                <YAxis tickLine={false} axisLine={false} tick={axis} domain={[35, 60]} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area dataKey="high" stroke="none" fill="var(--chart-1)" fillOpacity={0.16} name="Upper" />
                <Area dataKey="low" stroke="none" fill="var(--card)" fillOpacity={1} name="Lower" />
                <Line dataKey="actual" stroke="var(--chart-1)" strokeWidth={2} dot={false} name="Actual" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ActionLine text="Acting on the Block B recommendation removes the upper half of this range" />
        </Panel>
      </div>
    </Band>
  );
}

function MaintenanceDetail() {
  return (
    <div className="space-y-5">
      <Panel title="Assets that keep failing" subtitle="Repairs, failure rate and verdict">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Repairs</TableHead>
                <TableHead className="text-right">Failure rate</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Verdict</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ASSETS.map((a) => (
                <TableRow key={a.asset}>
                  <TableCell className="text-sm font-medium">{a.asset}</TableCell>
                  <TableCell className="num text-right">{a.repairs}</TableCell>
                  <TableCell className="num text-right">{a.failure}</TableCell>
                  <TableCell className="num text-right">{a.cost}</TableCell>
                  <TableCell className="text-right text-sm">{a.verdict}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ActionLine text="Approve replacement for ceiling fans — repair spend already exceeds replacement cost" />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Spend by block" subtitle="Financial year to date">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={COST_BY_BLOCK} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
                <XAxis dataKey="block" tickLine={false} axisLine={false} tick={axis} />
                <YAxis tickLine={false} axisLine={false} tick={axis} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="cost" radius={[5, 5, 0, 0]} fill="var(--chart-1)" barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ActionLine text="Block B absorbs 43% of maintenance spend for 25% of the rooms" />
        </Panel>

        <Panel title="Spend by complaint type" subtitle="Financial year to date">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={COST_BY_CATEGORY} layout="vertical" margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="category" tickLine={false} axisLine={false} width={82} tick={axis} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="cost" radius={[0, 5, 5, 0]} fill="var(--chart-3)" barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ActionLine text="Electrical spend alone would fund the full fan replacement programme" />
        </Panel>

        <Panel title="Budget utilisation" subtitle="Monthly spend against budget">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MONTHLY_SPEND} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axis} />
                <YAxis tickLine={false} axisLine={false} tick={axis} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line dataKey="budget" stroke="var(--chart-5)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                <Line dataKey="spend" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ActionLine text="Two consecutive months above budget — raise a revised August forecast" />
        </Panel>
      </div>
    </div>
  );
}
