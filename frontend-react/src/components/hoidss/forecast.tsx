import { ArrowUpRight } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionLine, Band, Panel } from "./primitives";
import { useForecast } from "./useHoidssData";

const axis = { fontSize: 11, fill: "var(--muted-foreground)" } as const;
const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

export function ForecastBand() {
  const { data, isLoading } = useForecast();

  if (isLoading || !data) {
    return (
      <section className="scroll-mt-32 animate-pulse opacity-50">
        <div className="h-12 w-1/3 bg-card rounded-md mb-8"></div>
        <div className="h-[400px] bg-card rounded-3xl border border-border"></div>
      </section>
    );
  }

  const { FORECAST, FORECAST_SERIES, MONTHLY_SPEND, ASSETS, verdict } = data;

  return (
    <Band
      id="forecast"
      question="Where is the trend heading?"
      verdict={verdict}
      detailLabel="Show trend detail"
      detailSummary="Category comparisons and 12-month complaint volumes"
      detail={<MaintenanceDetail ASSETS={ASSETS} MONTHLY_SPEND={MONTHLY_SPEND} />}
    >
      <div className="grid gap-5 lg:grid-cols-3">
        {FORECAST.map((f: any) => (
          <Panel key={f.id}>
            <p className="label-eyebrow">{f.label}</p>
            <p className="num mt-2 text-3xl font-semibold">{f.value}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{f.note}</p>
            <p className="mt-3 rounded-lg bg-crit-soft px-3 py-2 text-xs leading-5 text-crit-foreground">
              If ignored: {f.inaction}
            </p>
            {/* Confidence scores explicitly removed per requirements */}
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
                <Area dataKey="high" stroke="none" fill="var(--chart-1)" fillOpacity={0.16} name="Projected" />
                <Area dataKey="low" stroke="none" fill="var(--card)" fillOpacity={1} name="Projected" />
                <Line dataKey="actual" stroke="var(--chart-1)" strokeWidth={2} dot={false} name="Actual" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ActionLine text="Simple 7-day extrapolation based on the rolling average of the last 14 days" />
        </Panel>
      </div>
    </Band>
  );
}

function MaintenanceDetail({ ASSETS, MONTHLY_SPEND }: { ASSETS: any[], MONTHLY_SPEND: any[] }) {
  return (
    <div className="space-y-5">
      <Panel title="Category trend comparison" subtitle="This month vs last month">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Category</TableHead>
                <TableHead className="text-right">This Month</TableHead>
                <TableHead className="text-right">Last Month</TableHead>
                <TableHead className="text-right">Growth</TableHead>
                <TableHead className="text-right">Trend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ASSETS.map((a: any) => (
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
        <ActionLine text="Categories with positive growth indicate increasing complaint volume" />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-1">
        <Panel title="12-Month Complaint Trend" subtitle="Complaints created vs resolved">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MONTHLY_SPEND} margin={{ top: 4, right: 4, bottom: 0, left: -14 }}>
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axis} />
                <YAxis tickLine={false} axisLine={false} tick={axis} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line dataKey="spend" stroke="var(--chart-1)" strokeWidth={2} dot={false} name="Created" />
                <Line dataKey="budget" stroke="var(--ok)" strokeWidth={2} dot={false} name="Resolved" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <ActionLine text="Shows the long-term operational volume and resolution efficiency" />
        </Panel>
      </div>
    </div>
  );
}
