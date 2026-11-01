import { Link, useLocation } from "react-router-dom";
import { Menu, Moon, MoreHorizontal, Sun, type LucideIcon } from "lucide-react";
import { useState, useContext, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTheme } from "@/context/ThemeContext";
import { AuthContext } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

function initials(name: string) {
  if (!name) return "U";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export function ThemeButton({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const isDark = theme === "dark";
  const label = isDark ? t("common.light_mode", "Switch to light mode") : t("common.dark_mode", "Switch to dark mode");

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn("size-9 rounded-lg text-muted-foreground hover:text-foreground", className)}
    >
      {isDark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </Button>
  );
}

/**
 * Portable shell: mobile gets a bottom tab bar, desktop gets a quiet sidebar.
 * Navigation items are passed in, so each role composes its own information
 * architecture cleanly.
 */
export function AppShell({
  product = "Hostel Management",
  roleLabel,
  userName = "User",
  userSubtitle = "",
  nav,
  actions,
  children,
}: {
  product?: string;
  roleLabel: string;
  userName?: string;
  userSubtitle?: string;
  nav: NavItem[];
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const pathname = location.pathname;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Language choice is strictly reserved for STAFF, WARDEN, and HEADWARDEN only
  const showLanguageChoice = Boolean(user && ["STAFF", "WARDEN", "HEADWARDEN"].includes(user.role));

  // Best match: find the most specific navigation item matching the current pathname
  const activeNavItem = nav
    .filter((item) => item.to === pathname || (item.to !== "/" && pathname.startsWith(`${item.to}/`)))
    .sort((a, b) => b.to.length - a.to.length)[0];

  const isActive = (to: string) => activeNavItem?.to === to;

  // Split navigation for mobile: when > 4 items, show top 3 + "More"
  const isLargeNav = nav.length > 4;
  const mobilePrimaryNav = isLargeNav ? nav.slice(0, 3) : nav;
  const mobileOverflowNav = isLargeNav ? nav.slice(3) : [];
  const isOverflowActive = isLargeNav && mobileOverflowNav.some((item) => isActive(item.to));

  return (
    <div className="hms-root min-h-screen bg-background text-foreground">
      <div className="lg:flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col border-r border-border bg-sidebar lg:flex">
          <div className="px-4 py-4">
            <p className="text-sm font-semibold tracking-tight">{product}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <nav className="flex-1 space-y-1 px-2.5" aria-label="Main">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-1.5 border-t border-border px-3 py-3">
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="text-xs">{initials(userName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{userName}</p>
              <p className="truncate text-[11px] text-muted-foreground">{userSubtitle}</p>
            </div>
            <ThemeButton className="size-8 shrink-0" />
          </div>
        </aside>

        {/* Mobile Navigation Sheet Drawer */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="flex w-72 flex-col p-0 sm:w-80">
            <SheetHeader className="border-b border-border p-4 text-left">
              <SheetTitle className="text-base font-bold tracking-tight">{product}</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                {roleLabel} · {t("common.app_title", "Hostel Management")}
              </SheetDescription>
            </SheetHeader>

            {/* User profile card inside mobile menu */}
            <div className="flex items-center gap-3 border-b border-border/70 bg-muted/30 px-4 py-3">
              <Avatar className="size-9 shrink-0">
                <AvatarFallback className="text-xs font-semibold">{initials(userName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
                <p className="truncate text-xs text-muted-foreground">{userSubtitle}</p>
              </div>
            </div>

            {/* Navigation links */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("nav.menu", "Menu")}
              </p>
              <nav className="space-y-1" aria-label="Mobile Drawer Navigation">
                {nav.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.to);
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary/10 font-bold text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Footer with language, theme toggle and actions */}
            <div className="border-t border-border p-4 space-y-2">
              {showLanguageChoice && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t("common.language", "Language")}</span>
                  <LanguageSwitcher />
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("common.theme", "Theme")}</span>
                <ThemeButton />
              </div>
              {actions ? <div className="pt-2">{actions}</div> : null}
            </div>
          </SheetContent>
        </Sheet>

        <div className="min-w-0 flex-1">
          {/* Top bar */}
          <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
              <div className="flex items-center gap-2.5 min-w-0 lg:hidden">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileMenuOpen(true)}
                  className="size-9 rounded-lg text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                  aria-label="Open navigation menu"
                >
                  <Menu className="size-5" />
                </Button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold tracking-tight">{product}</p>
                  <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
                </div>
              </div>

              <div className="flex flex-1 items-center justify-end gap-2">
                {showLanguageChoice && <LanguageSwitcher />}
                <div className="lg:hidden">
                  <ThemeButton />
                </div>
                {actions}
              </div>
            </div>
          </header>

          {/* Main content */}
          <main className="mx-auto max-w-5xl px-4 pt-6 pb-28 sm:px-6 sm:pb-12">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-background/95 py-1.5 backdrop-blur lg:hidden"
      >
        {mobilePrimaryNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors max-w-[80px] text-center truncate",
                active ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="truncate w-full">{item.label}</span>
            </Link>
          );
        })}

        {/* Overflow "More" button when navigation has more than 4 items */}
        {isLargeNav && (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open more navigation options"
            className={cn(
              "flex flex-col items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors max-w-[80px] text-center cursor-pointer",
              isOverflowActive ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MoreHorizontal className="size-5 shrink-0" aria-hidden />
            <span className="truncate w-full">{t("common.details", "More")}</span>
          </button>
        )}
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40 p-8 text-center sm:p-12">
      {Icon ? (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-6" aria-hidden />
        </div>
      ) : null}
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
