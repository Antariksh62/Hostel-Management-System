import React, { useState, useEffect, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Clock,
  Plus,
  Loader2,
  FileText,
  CheckCircle2,
  XCircle,
  MessageSquare
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/hms/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthContext } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import api from "@/services/api";
import { cn } from "@/lib/utils";

export default function SecurityDashboard() {
  const { user } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [activeIncident, setActiveIncident] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);

  // New incident form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    severity: "MEDIUM",
  });

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["security-incidents"],
    queryFn: () => api.get("/security/incidents").then((r) => r.data || []),
  });

  // Socket updates
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => queryClient.invalidateQueries({ queryKey: ["security-incidents"] });
    socket.on("incident:created", handleUpdate);
    socket.on("incident:updated", handleUpdate);
    return () => {
      socket.off("incident:created", handleUpdate);
      socket.off("incident:updated", handleUpdate);
    };
  }, [socket, queryClient]);

  const filteredIncidents = incidents.filter((inc) => {
    if (statusFilter !== "ALL" && inc.status !== statusFilter) return false;
    if (severityFilter !== "ALL" && inc.severity !== severityFilter) return false;
    return true;
  });

  const criticalCount = incidents.filter((i) => i.severity === "CRITICAL").length;
  const activeCount = incidents.filter((i) => i.status !== "RESOLVED" && i.status !== "CLOSED").length;
  const resolvedCount = incidents.filter((i) => i.status === "RESOLVED" || i.status === "CLOSED").length;

  const handleCreateIncident = async (e) => {
    e.preventDefault();
    if (!form.title || !form.location) return;
    setBusy(true);
    try {
      await api.post("/security/incidents", form);
      setIsReportOpen(false);
      setForm({ title: "", description: "", location: "", severity: "MEDIUM" });
      queryClient.invalidateQueries({ queryKey: ["security-incidents"] });
    } catch (err) {
      alert(err.response?.data?.message || "Failed to log incident");
    } finally {
      setBusy(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await api.patch(`/security/incidents/${id}/status`, { status });
      queryClient.invalidateQueries({ queryKey: ["security-incidents"] });
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update incident status");
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!activeIncident || !noteText.trim()) return;
    setBusy(true);
    try {
      await api.post(`/security/incidents/${activeIncident._id}/notes`, { note: noteText.trim() });
      setIsNoteOpen(false);
      setNoteText("");
      queryClient.invalidateQueries({ queryKey: ["security-incidents"] });
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add note");
    } finally {
      setBusy(false);
    }
  };

  const nav = [
    { to: "/security-dashboard", label: "Security Incidents", icon: ShieldAlert },
  ];

  return (
    <AppShell
      product="Campus Security"
      roleLabel="Security Incident Response"
      userName={user?.fullName || "Security Officer"}
      userSubtitle={user?.email}
      nav={nav}
    >
      <PageHeader
        title="Hostel Security Operations Desk"
        description="Real-time incident logging, perimeter tracking, and tactical security supervisor response."
        action={
          <Button onClick={() => setIsReportOpen(true)} className="gap-2">
            <Plus className="size-4" /> Log Security Incident
          </Button>
        }
      />

      {/* KPI Stats */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Incidents</span>
            <AlertTriangle className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-foreground">{activeCount}</p>
          <span className="text-xs text-muted-foreground">Requires on-duty attention</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Critical Severity</span>
            <ShieldAlert className="size-4 text-red-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-red-600 dark:text-red-400">{criticalCount}</p>
          <span className="text-xs text-muted-foreground">Immediate escalation tier</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Resolved Cases</span>
            <ShieldCheck className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{resolvedCount}</p>
          <span className="text-xs text-muted-foreground">Closed & stabilized</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status:</span>
          {["ALL", "REPORTED", "UNDER_INVESTIGATION", "ACTION_TAKEN", "RESOLVED", "CLOSED"].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)}
              className="text-xs h-8 px-2.5"
            >
              {s.replace("_", " ")}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Severity:</span>
          {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
            <Button
              key={sev}
              size="sm"
              variant={severityFilter === sev ? "secondary" : "ghost"}
              onClick={() => setSeverityFilter(sev)}
              className="text-xs h-8 px-2.5"
            >
              {sev}
            </Button>
          ))}
        </div>
      </div>

      {/* Incident List */}
      <div className="mt-6 space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <ShieldCheck className="mx-auto size-8 text-emerald-500 mb-2" />
            <p className="font-semibold text-foreground">No security incidents logged</p>
            <p className="text-xs">All sectors operating normally.</p>
          </div>
        ) : (
          filteredIncidents.map((inc) => (
            <div
              key={inc._id}
              className={cn(
                "rounded-xl border p-5 transition-all bg-card space-y-3",
                inc.severity === "CRITICAL"
                  ? "border-red-500/50 bg-red-500/5 dark:bg-red-950/20"
                  : inc.severity === "HIGH"
                  ? "border-amber-500/40"
                  : "border-border"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground">{inc.title}</span>
                    <Badge
                      variant={
                        inc.severity === "CRITICAL"
                          ? "destructive"
                          : inc.severity === "HIGH"
                          ? "warning"
                          : "outline"
                      }
                      className="text-[10px] font-extrabold"
                    >
                      {inc.severity}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {inc.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3 text-primary" /> {inc.location}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" /> {new Date(inc.createdAt).toLocaleString("en-IN")}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 gap-1.5"
                    onClick={() => {
                      setActiveIncident(inc);
                      setIsNoteOpen(true);
                    }}
                  >
                    <MessageSquare className="size-3.5" /> Log Note
                  </Button>

                  {inc.status !== "RESOLVED" && inc.status !== "CLOSED" && (
                    <Button
                      size="sm"
                      className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleStatusUpdate(inc._id, "RESOLVED")}
                    >
                      Mark Resolved
                    </Button>
                  )}
                </div>
              </div>

              {inc.description && (
                <p className="text-sm text-foreground/90 bg-muted/30 p-3 rounded-lg border border-border/40">
                  {inc.description}
                </p>
              )}

              {/* Investigation Notes Feed */}
              {inc.notes && inc.notes.length > 0 && (
                <div className="pt-2 border-t border-border/40 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Officer Notes:</span>
                  <div className="space-y-1">
                    {inc.notes.map((n, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="font-semibold text-foreground">{n.officerName || "Officer"}:</span>
                        <span>{n.note}</span>
                        <span className="text-[10px] opacity-70">({new Date(n.timestamp).toLocaleTimeString()})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Log Incident Dialog */}
      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log Campus Security Incident</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateIncident} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="inc-title">Incident Title</Label>
              <Input
                id="inc-title"
                required
                placeholder="e.g. Unauthorized entry at Rear Gate"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inc-loc">Location / Perimeter</Label>
              <Input
                id="inc-loc"
                required
                placeholder="e.g. Hostel B Ground Floor Corridor"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inc-sev">Severity Level</Label>
              <select
                id="inc-sev"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inc-desc">Incident Description</Label>
              <textarea
                id="inc-desc"
                rows={3}
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
                placeholder="Detailed observations and actions taken..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsReportOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : null} Log Incident
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={isNoteOpen} onOpenChange={setIsNoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Officer Note</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddNote} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="officer-note">Investigation / Log Note</Label>
              <textarea
                id="officer-note"
                rows={3}
                required
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
                placeholder="Enter field update or statement..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsNoteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : null} Save Note
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

