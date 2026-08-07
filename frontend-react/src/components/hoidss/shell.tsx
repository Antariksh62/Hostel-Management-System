import {
  Bell,
  Building2,
  Calendar,
  ChevronsLeft,
  ChevronsRight,
  CircleDollarSign,
  ClipboardList,
  CornerUpLeft,
  Gauge,
  LayoutGrid,
  Moon,
  Search,
  Settings,
  Sun,
  TrendingUp,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { scopeLabel, useInvestigation, type Scope } from "./context";
import { HOSTEL, NOTIFICATIONS } from "./data";
import { healthRail, StatusPill } from "./primitives";

const NAV = [
  { label: "Today", icon: Gauge, target: "brief", active: true },
  { label: "Complaints", icon: ClipboardList, target: "complaints" },
  { label: "Spaces", icon: LayoutGrid, target: "heatmap" },
  { label: "People", icon: Users, target: "ownership" },
  { label: "Assets", icon: Wrench, target: "forecast" },
  { label: "Money", icon: CircleDollarSign, target: "forecast" },
  { label: "Forecast", icon: TrendingUp, target: "forecast" },
];

export function HostelSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
        collapsed ? "w-[72px]" : "w-[248px]",
      )}
      aria-label="Hostel operations navigation"
    >
      <div>
        <div className="flex h-[68px] items-center gap-3 px-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Building2 className="h-[18px] w-[18px]" aria-hidden />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">HOIDSS</span>
              <span className="block truncate text-[0.6875rem] text-muted-foreground">Operations Intelligence</span>
            </span>
          )}
        </div>

        {!collapsed && (
          <div className="mx-3 mb-4 rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3">
            <p className="text-[0.8125rem] font-medium leading-5">{HOSTEL.name}</p>
            <p className="mt-1 text-[0.6875rem] text-muted-foreground">{HOSTEL.shift}</p>
          </div>
        )}

        <nav className="px-3">
          <p className={cn("label-eyebrow mb-2 px-2", collapsed && "sr-only")}>Operations</p>
          <ul className="space-y-1">
            {NAV.map((item) => (
              <li key={item.label}>
                <a
                  href={`#band-${item.target}`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                    item.active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="space-y-1 px-3 pb-5">
        <a
          href="#band-brief"
          className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent/60"
        >
          <Settings className="h-[18px] w-[18px] shrink-0" aria-hidden />
          {!collapsed && <span>Settings</span>}
        </a>
        <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-[0.6875rem] font-semibold">
            AD
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-[0.8125rem] font-medium">Dr. A. Deshpande</span>
              <span className="block truncate text-[0.6875rem] text-muted-foreground">Chief Warden</span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
        >
          {collapsed ? (
            <ChevronsRight className="h-[18px] w-[18px] shrink-0" aria-hidden />
          ) : (
            <ChevronsLeft className="h-[18px] w-[18px] shrink-0" aria-hidden />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

export function TopBar() {
  const [dark, setDark] = useState(true);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <>
      <header className="glass-bar sticky top-0 z-30 border-b border-border">
        <div className="mx-auto grid max-w-[1440px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5 sm:px-8">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[0.6875rem] text-muted-foreground">
              <span className="truncate">{HOSTEL.campus}</span>
              <span aria-hidden>/</span>
              <span className="truncate text-foreground">{HOSTEL.name}</span>
            </nav>
            <div className="mt-1 flex min-w-0 items-center gap-3">
              <h1 className="truncate text-base font-semibold sm:text-[1.0625rem]">Today's Operational Status</h1>
              <StatusPill health={HOSTEL.status === "Stable" ? "ok" : HOSTEL.status === "Strained" ? "warn" : "crit"}>
                {HOSTEL.status}
              </StatusPill>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="hidden items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:flex"
            >
              <Search className="h-4 w-4" aria-hidden />
              <span>Search rooms, staff, complaints</span>
              <kbd className="ml-6 rounded border border-border px-1.5 py-0.5 text-[0.625rem]">⌘K</kbd>
            </button>
            <button
              type="button"
              className="hidden items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex"
            >
              <Calendar className="h-4 w-4" aria-hidden />
              Last 14 days
            </button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setDark((d) => !d)}
            >
              {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open notification centre, 3 unread"
              className="relative"
              onClick={() => setNotifOpen(true)}
            >
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-crit" aria-hidden />
            </Button>
          </div>
        </div>
        <ContextBar />
      </header>

      <NotificationCenter open={notifOpen} onOpenChange={setNotifOpen} />
    </>
  );
}

function ContextBar() {
  const { scope, clearKey, clearAll, stepBack, history, isActive } = useInvestigation();
  const chips = (["category", "block", "floor", "room", "severity", "staff"] as (keyof Scope)[])
    .map((key) => ({ key, value: scope[key] }))
    .filter((c): c is { key: keyof Scope; value: string } => Boolean(c.value));

  return (
    <div className="border-t border-border/70">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-2 px-5 py-2.5 sm:px-8">
        <span className="label-eyebrow">Investigating</span>
        {chips.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            {scopeLabel(scope)} · {scope.dateRange} — select any metric, room or alert to narrow the investigation
          </span>
        ) : (
          <>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => clearKey(chip.key)}
                className="group inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-info-soft px-2.5 py-1 text-xs text-foreground transition-colors duration-150 hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {chip.value}
                <X className="h-3 w-3 text-muted-foreground group-hover:text-foreground" aria-hidden />
                <span className="sr-only">Remove {chip.value} from the investigation</span>
              </button>
            ))}
            {history.length > 0 && (
              <button
                type="button"
                onClick={stepBack}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <CornerUpLeft className="h-3 w-3" aria-hidden /> Step back
              </button>
            )}
            <button
              type="button"
              onClick={clearAll}
              className="ml-auto rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Clear all
            </button>
          </>
        )}
        {!isActive && (
          <span className="ml-auto hidden text-[0.6875rem] text-muted-foreground sm:block">
            Detail stays hidden until you ask for it
          </span>
        )}
      </div>
    </div>
  );
}

function NotificationCenter({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { narrow } = useInvestigation();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full border-border bg-background p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-5">
          <SheetTitle className="text-base">Notification centre</SheetTitle>
          <SheetDescription>Live operational events. Select one to investigate it.</SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-96px)]">
          <div className="space-y-7 px-6 py-6">
            {NOTIFICATIONS.map((group) => (
              <div key={group.group}>
                <p className="label-eyebrow mb-3">{group.group}</p>
                <ul className="space-y-2">
                  {group.items.map((item) => (
                    <li key={item.title}>
                      <button
                        type="button"
                        onClick={() => {
                          const block = item.meta.match(/Block [A-D]/)?.[0];
                          narrow(block ? { block } : {});
                          onOpenChange(false);
                        }}
                        className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors duration-150 hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", healthRail[item.severity])} aria-hidden />
                        <span className="min-w-0">
                          <span className="block text-[0.8125rem] font-medium leading-5">{item.title}</span>
                          <span className="mt-0.5 block truncate text-[0.6875rem] text-muted-foreground">{item.meta}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
