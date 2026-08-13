import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type Scope = {
  category?: string;
  block?: string;
  floor?: string;
  room?: string;
  severity?: string;
  staff?: string;
  dateRange: string;
};

export type DrawerEntity = {
  kind: "Room" | "Complaint" | "Signal" | "Staff" | "Alert" | "Asset";
  title: string;
  subtitle: string;
  health: "ok" | "warn" | "crit";
  facts: { label: string; value: string }[];
};

export type DrilldownListConfig = {
  title: string;
  subtitle?: string;
  filter: {
    status?: string;
    category?: string;
    overdue?: boolean;
    recent24h?: boolean;
    floor?: string;
    room?: string;
  };
} | null;

type InvestigationValue = {
  scope: Scope;
  history: Scope[];
  narrow: (patch: Partial<Scope>) => void;
  clearKey: (key: keyof Scope) => void;
  clearAll: () => void;
  stepBack: () => void;
  isActive: boolean;
  drawer: DrawerEntity | null;
  openDrawer: (entity: DrawerEntity) => void;
  closeDrawer: () => void;
  drilldownList: DrilldownListConfig;
  openDrilldownList: (config: DrilldownListConfig) => void;
  closeDrilldownList: () => void;
  evidenceTarget: string | null;
  jumpToEvidence: (target: string, patch?: Partial<Scope>) => void;
  decided: string[];
  decide: (id: string) => void;
};

const DEFAULT_SCOPE: Scope = { dateRange: "Last 14 days" };

const InvestigationContext = createContext<InvestigationValue | null>(null);

export function InvestigationProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<Scope>(DEFAULT_SCOPE);
  const [history, setHistory] = useState<Scope[]>([]);
  const [drawer, setDrawer] = useState<DrawerEntity | null>(null);
  const [drilldownList, setDrilldownList] = useState<DrilldownListConfig>(null);
  const [evidenceTarget, setEvidenceTarget] = useState<string | null>(null);
  const [decided, setDecided] = useState<string[]>([]);

  const narrow = useCallback((patch: Partial<Scope>) => {
    setScope((prev) => {
      setHistory((h) => [...h, prev]);
      return { ...prev, ...patch };
    });
  }, []);

  const clearKey = useCallback((key: keyof Scope) => {
    if (key === "dateRange") return;
    setScope((prev) => {
      setHistory((h) => [...h, prev]);
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setScope(DEFAULT_SCOPE);
    setHistory([]);
  }, []);

  const stepBack = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1]!;
      setScope(prev);
      return h.slice(0, -1);
    });
  }, []);

  const jumpToEvidence = useCallback(
    (target: string, patch?: Partial<Scope>) => {
      if (patch) narrow(patch);
      setEvidenceTarget(target);
      if (typeof document !== "undefined") {
        const el = document.getElementById(`band-${target}`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      window.setTimeout(() => setEvidenceTarget(null), 1400);
    },
    [narrow],
  );

  const decide = useCallback((id: string) => {
    setDecided((d) => (d.includes(id) ? d : [...d, id]));
  }, []);

  const value = useMemo<InvestigationValue>(
    () => ({
      scope,
      history,
      narrow,
      clearKey,
      clearAll,
      stepBack,
      isActive: Boolean(scope.category || scope.block || scope.floor || scope.room || scope.severity || scope.staff),
      drawer,
      openDrawer: setDrawer,
      closeDrawer: () => setDrawer(null),
      drilldownList,
      openDrilldownList: setDrilldownList,
      closeDrilldownList: () => setDrilldownList(null),
      evidenceTarget,
      jumpToEvidence,
      decided,
      decide,
    }),
    [scope, history, narrow, clearKey, clearAll, stepBack, drawer, drilldownList, evidenceTarget, jumpToEvidence, decided, decide],
  );

  return <InvestigationContext.Provider value={value}>{children}</InvestigationContext.Provider>;
}

export function useInvestigation() {
  const ctx = useContext(InvestigationContext);
  if (!ctx) throw new Error("useInvestigation must be used inside InvestigationProvider");
  return ctx;
}

/** Human sentence describing the active investigation, used in band verdicts. */
export function scopeLabel(scope: Scope) {
  const parts = [scope.category, scope.block, scope.floor, scope.room, scope.severity, scope.staff].filter(Boolean);
  return parts.length ? parts.join(" · ") : "the whole hostel";
}
