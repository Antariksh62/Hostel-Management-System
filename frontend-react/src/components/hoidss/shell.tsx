import {
  Bell,
  Building2,
  Calendar,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  CornerUpLeft,
  Gauge,
  GraduationCap,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  TrendingUp,
  UserCheck,
  Users,
  Wifi,
  Wrench,
  X,
} from "lucide-react";
import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../context/ThemeContext";
import { AuthContext } from "../../context/AuthContext";

import { Button } from "@/components/ui/button";
import AdminNotificationBell from "@/components/notifications/AdminNotificationBell";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { scopeLabel, useInvestigation, type Scope } from "./context";
import { HOSTEL, NOTIFICATIONS } from "./data";
import { healthRail, StatusPill } from "./primitives";

export const INCHARGE_NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: Gauge, desc: "Executive brief & operational KPIs" },
  { id: "complaints", label: "Complaints & Hotspots", icon: ClipboardList, desc: "77-room heat map & triage" },
  { id: "residents", label: "Residents & Rooms", icon: UserCheck, desc: "Directory & room occupancy" },
  { id: "staff", label: "Staff Oversight", icon: Users, desc: "Workload & verified resolutions" },
  { id: "admissions", label: "Student Admissions & Eligibility", icon: GraduationCap, desc: "Roster, OTP access & bulk upload" },
  { id: "wifi", label: "Wi-Fi Dashboard", icon: Wifi, desc: "Specialist networking portal", isExternal: true },
];

export function HostelSidebar({
  collapsed,
  onToggle,
  activeTab = "overview",
  onSelectTab,
}: {
  collapsed: boolean;
  onToggle: () => void;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
}) {
  const { t } = useTranslation();
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleNavClick = (item: (typeof INCHARGE_NAV_ITEMS)[0]) => {
    if (item.isExternal) {
      navigate("/wifi-dashboard");
      return;
    }
    if (onSelectTab) {
      onSelectTab(item.id);
    } else {
      navigate(`/incharge-dashboard?tab=${item.id}`);
    }
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "IC";

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
          <p className={cn("label-eyebrow mb-3 px-2 font-bold tracking-widest", collapsed && "sr-only")}>
            {t("nav.operations", "Operations")}
          </p>
          <ul className="space-y-1.5">
            {INCHARGE_NAV_ITEMS.map((item) => {
              const isActive = !item.isExternal && activeTab === item.id;
              const Icon = item.icon;

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleNavClick(item)}
                    className={cn(
                      "flex w-full items-center gap-3.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none cursor-pointer",
                      isActive
                        ? "bg-sidebar-accent font-bold text-sidebar-accent-foreground shadow-soft"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    {!collapsed && (
                      <span className="flex-1 text-left truncate">{item.label}</span>
                    )}
                    {!collapsed && item.isExternal && (
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        Portal
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="space-y-2 px-4 pb-6 border-t border-sidebar-border/70 pt-4">
        {/* Dynamic Authenticated User Info */}
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary text-xs font-bold">
            {initials}
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{user?.name || "Hostel In-Charge"}</span>
              <span className="block truncate text-xs text-muted-foreground font-medium">Hostel In-Charge</span>
            </div>
          )}
        </div>

        {/* Accessible Sign Out Button */}
        <button
          type="button"
          onClick={() => {
            logout();
            navigate("/");
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-destructive transition-colors duration-150 hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none cursor-pointer"
          title={collapsed ? "Sign out" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden />
          {!collapsed && <span>{t("common.sign_out", "Sign out")}</span>}
        </button>

        {/* Sidebar Collapse Toggle */}
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none cursor-pointer"
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <ChevronsLeft className="h-4 w-4 shrink-0" aria-hidden />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

export function TopBar({
  activeTab = "overview",
  onSelectTab,
}: {
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const dark = theme === "dark";
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { scope, narrow } = useInvestigation();

  const DATE_OPTIONS = ["Last 7 days", "Last 14 days", "Last 30 days", "Last 90 days"];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.trim();
    if (/^[1-5]\d\d$/.test(q)) {
      narrow({ room: q });
      if (onSelectTab) onSelectTab("complaints");
    } else {
      narrow({ category: q });
      if (onSelectTab) onSelectTab("complaints");
    }
    setSearchOpen(false);
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case "complaints":
        return "Complaints & Spatial Hotspots";
      case "residents":
        return "Residents Directory & Room Occupancy";
      case "staff":
        return "Staff Oversight & Resolution Attribution";
      case "admissions":
        return "Student Admissions & Eligibility Management";
      case "overview":
      default:
        return "Today's Operational Status";
    }
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "IC";

  return (
    <>
      <header className="glass-bar sticky top-0 z-30 border-b border-border shadow-soft">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 px-4 py-3 sm:px-8 lg:px-12">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileNavOpen(true)}
              className="h-9 w-9 rounded-xl lg:hidden shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
              aria-label="Open operations menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="truncate">{HOSTEL.campus}</span>
                <span aria-hidden>/</span>
                <span className="truncate font-semibold text-foreground">{HOSTEL.name}</span>
              </nav>
              <div className="mt-1 flex min-w-0 items-center gap-2.5 sm:gap-3.5">
                <h1 className="truncate text-base font-bold sm:text-xl">{getTabTitle()}</h1>
                <StatusPill health={HOSTEL.status === "Stable" ? "ok" : HOSTEL.status === "Strained" ? "warn" : "crit"}>
                  {HOSTEL.status}
                </StatusPill>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {/* Functional Search Bar */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSearchOpen((v) => !v)}
                className="hidden items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:flex cursor-pointer"
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
                      <span>Press Enter to filter</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setSearchOpen(false);
                        }}
                        className="hover:underline cursor-pointer"
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
                className="hidden items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:border-border-strong hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex cursor-pointer"
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
                            "w-full rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-secondary cursor-pointer",
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
              className="h-10 w-10 rounded-xl cursor-pointer"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={toggleTheme}
            >
              {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <AdminNotificationBell />
          </div>
        </div>
        <ContextBar />
      </header>

      {/* Mobile Operations Navigation Drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0 sm:w-80">
          <SheetHeader className="border-b border-border p-4 text-left">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <Building2 className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <SheetTitle className="text-base font-bold">HOIDSS</SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground font-medium">
                  Operations Intelligence
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="mx-4 my-3 rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3">
            <p className="text-xs font-semibold leading-4">{HOSTEL.name}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{HOSTEL.shift}</p>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("nav.operations", "Operations")}
            </p>
            <ul className="space-y-1">
              {INCHARGE_NAV_ITEMS.map((item) => {
                const isActive = !item.isExternal && activeTab === item.id;
                const Icon = item.icon;

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileNavOpen(false);
                        if (item.isExternal) {
                          navigate("/wifi-dashboard");
                        } else if (onSelectTab) {
                          onSelectTab(item.id);
                        } else {
                          navigate(`/incharge-dashboard?tab=${item.id}`);
                        }
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-left cursor-pointer",
                        isActive
                          ? "bg-sidebar-accent font-bold text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {item.isExternal && (
                        <span className="text-[9px] uppercase font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground">
                          Portal
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Mobile Profile & Logout */}
          <div className="border-t border-border p-4 space-y-3">
            <div className="flex items-center gap-3 rounded-xl px-2 py-1">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary text-xs font-bold">
                {initials}
              </span>
              <div className="min-w-0">
                <span className="block truncate text-xs font-semibold">{user?.name || "Hostel In-Charge"}</span>
                <span className="block truncate text-[10px] text-muted-foreground">Hostel In-Charge</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setMobileNavOpen(false);
                logout();
                navigate("/");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/15 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>{t("common.sign_out", "Sign out")}</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

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
        <span className="label-eyebrow font-bold tracking-wider">Active Filters</span>
        {chips.length === 0 ? (
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">
            {scopeLabel(scope)} · {scope.dateRange} — select any room or metric to focus views
          </span>
        ) : (
          <>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => clearKey(chip.key)}
                className="group inline-flex items-center gap-2 rounded-full border border-primary/40 bg-info-soft px-3 py-1 text-xs font-semibold text-foreground transition-colors duration-150 hover:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer"
              >
                {chip.value}
                <X className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" aria-hidden />
                <span className="sr-only">Remove {chip.value} filter</span>
              </button>
            ))}
            {history.length > 0 && (
              <button
                type="button"
                onClick={stepBack}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer"
              >
                <CornerUpLeft className="h-3.5 w-3.5" aria-hidden /> Step back
              </button>
            )}
            <button
              type="button"
              onClick={clearAll}
              className="ml-auto rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none cursor-pointer"
            >
              Clear all
            </button>
          </>
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
          <SheetDescription>Live operational events.</SheetDescription>
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
