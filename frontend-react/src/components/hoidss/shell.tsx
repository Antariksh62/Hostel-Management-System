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
import { useTheme } from "../../context/ThemeContext";

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
        "sticky top-0 hidden h-screen shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex z-40",
        collapsed ? "w-[76px]" : "w-[260px]",
      )}
      aria-label="Hostel operations navigation"
    >
      <div>
        <div className="flex h-[76px] items-center gap-3.5 px-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Building2 className="h-5 w-5" aria-hidden />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-base font-bold">HOIDSS</span>
              <span className="block truncate text-xs text-muted-foreground font-medium">Operations Intelligence</span>
            </span>
          )}
        </div>

        {!collapsed && (
          <div className="mx-4 mb-6 rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-4">
            <p className="text-sm font-semibold leading-5">{HOSTEL.name}</p>
            <p className="mt-1 text-xs text-muted-foreground font-medium">{HOSTEL.shift}</p>
          </div>
        )}

        <nav className="px-4">
          <p className={cn("label-eyebrow mb-3 px-2 font-bold tracking-widest", collapsed && "sr-only")}>Operations</p>
          <ul className="space-y-1.5">
            {NAV.map((item) => (
              <li key={item.label}>
                <a
                  href={`#band-${item.target}`}
                  className={cn(
                    "flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                    item.active
                      ? "bg-sidebar-accent font-bold text-sidebar-accent-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <item.icon className="h-5 w-5 shrink-0" aria-hidden />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="space-y-1.5 px-4 pb-6">
        <div className="flex items-center gap-3.5 rounded-xl px-3 py-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold">
            AD
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">Dr. A. Deshpande</span>
              <span className="block truncate text-xs text-muted-foreground">Chief Warden</span>
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-3.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
        >
          {collapsed ? (
            <ChevronsRight className="h-5 w-5 shrink-0" aria-hidden />
          ) : (
            <ChevronsLeft className="h-5 w-5 shrink-0" aria-hidden />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const { scope, narrow, openDrawer } = useInvestigation();

  const DATE_OPTIONS = ["Last 7 days", "Last 14 days", "Last 30 days", "Last 90 days"];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.trim();
    // If user enters a 3-digit room number (e.g. 101, 204)
    if (/^[1-5]\d\d$/.test(q)) {
      narrow({ room: q });
      openDrawer({
        kind: "Room",
        title: `Room ${q}`,
        subtitle: `Direct Search · Floor ${q.charAt(0)}`,
        health: "ok",
        facts: [
          { label: "Search Match", value: `Room ${q}` },
          { label: "Floor", value: `Floor ${q.charAt(0)}` }
        ]
      });
    } else {
      narrow({ category: q });
    }
    setSearchOpen(false);
  };

  return (
    <>
      <header className="glass-bar sticky top-0 z-30 border-b border-border shadow-soft">
        <div className="mx-auto grid max-w-[1680px] grid-cols-[minmax(0,1fr)_auto] items-center gap-6 px-8 py-4 sm:px-12">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className="truncate">{HOSTEL.campus}</span>
              <span aria-hidden>/</span>
              <span className="truncate font-semibold text-foreground">{HOSTEL.name}</span>
            </nav>
            <div className="mt-1.5 flex min-w-0 items-center gap-3.5">
              <h1 className="truncate text-lg font-bold sm:text-xl">Today's Operational Status</h1>
              <StatusPill health={HOSTEL.status === "Stable" ? "ok" : HOSTEL.status === "Strained" ? "warn" : "crit"}>
                {HOSTEL.status}
              </StatusPill>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {/* Functional Search Bar */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                className="hidden items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:flex"
              >
                <Search className="h-4 w-4" aria-hidden />
                <span>{searchQuery ? `Searching: ${searchQuery}` : "Search rooms, staff, complaints"}</span>
                <kbd className="ml-6 rounded border border-border px-2 py-0.5 text-[0.625rem] font-mono">⌘K</kbd>
              </button>

              {searchOpen && (
                <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-border bg-popover p-4 shadow-lift">
                  <form onSubmit={handleSearchSubmit} className="space-y-3">
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
                      <Search className="h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Search room (e.g. 101), category..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                      {searchQuery && (
                        <button type="button" onClick={() => setSearchQuery("")}>
                          <X className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[0.6875rem] text-muted-foreground">
                      <span>Press Enter to search</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setSearchOpen(false);
                        }}
                        className="hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            {/* Functional Date Range Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setDateOpen((v) => !v)}
                className="hidden items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex"
              >
                <Calendar className="h-4 w-4" aria-hidden />
                <span>{scope.dateRange || "Last 14 days"}</span>
              </button>

              {dateOpen && (
                <div className="absolute right-0 top-12 z-50 w-48 rounded-2xl border border-border bg-popover p-2 shadow-lift">
                  <div className="px-3 py-2 text-xs font-bold text-muted-foreground">Select Time Window</div>
                  <ul className="space-y-1">
                    {DATE_OPTIONS.map((opt) => (
                      <li key={opt}>
                        <button
                          type="button"
                          onClick={() => {
                            narrow({ dateRange: opt });
                            setDateOpen(false);
                          }}
                          className={cn(
                            "w-full rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-secondary",
                            scope.dateRange === opt && "bg-info-soft font-bold text-foreground"
                          )}
                        >
                          {opt}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggleTheme}
            >
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open notification centre, 3 unread"
              className="relative h-10 w-10 rounded-xl"
              onClick={() => setNotifOpen(true)}
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-crit" aria-hidden />
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
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-center gap-3 px-8 py-3 sm:px-12">
        <span className="label-eyebrow font-bold tracking-wider">Investigating</span>
        {chips.length === 0 ? (
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">
            {scopeLabel(scope)} · {scope.dateRange} — select any metric, room or alert to narrow the investigation
          </span>
        ) : (
          <>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => clearKey(chip.key)}
                className="group inline-flex items-center gap-2 rounded-full border border-primary/40 bg-info-soft px-3 py-1 text-xs font-semibold text-foreground transition-colors duration-150 hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {chip.value}
                <X className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" aria-hidden />
                <span className="sr-only">Remove {chip.value} from the investigation</span>
              </button>
            ))}
            {history.length > 0 && (
              <button
                type="button"
                onClick={stepBack}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <CornerUpLeft className="h-3.5 w-3.5" aria-hidden /> Step back
              </button>
            )}
            <button
              type="button"
              onClick={clearAll}
              className="ml-auto rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              Clear all
            </button>
          </>
        )}
        {!isActive && (
          <span className="ml-auto hidden text-xs font-medium text-muted-foreground sm:block">
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
