import React, { useState, useEffect, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  Lock,
  EyeOff,
  AlertOctagon,
  FileCheck,
  Plus,
  Loader2,
  FileText,
  Clock,
  UserX,
  CheckCircle2,
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

export default function AntiRaggingDashboard() {
  const { user } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [isCaseOpen, setIsCaseOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [activeCase, setActiveCase] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [actionForm, setActionForm] = useState({ actionType: "WRITTEN_WARNING", details: "" });
  const [busy, setBusy] = useState(false);

  // New case form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    location: "",
    severity: "SERIOUS",
    isAnonymous: true,
  });

  const { data: cases = [], isLoading, error } = useQuery({
    queryKey: ["antiragging-cases"],
    queryFn: () => api.get("/anti-ragging/cases").then((r) => r.data || []),
  });

  // Socket updates
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => queryClient.invalidateQueries({ queryKey: ["antiragging-cases"] });
    socket.on("antiragging:created", handleUpdate);
    socket.on("antiragging:updated", handleUpdate);
    return () => {
      socket.off("antiragging:created", handleUpdate);
      socket.off("antiragging:updated", handleUpdate);
    };
  }, [socket, queryClient]);

  const filteredCases = cases.filter((c) => {
    if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
    return true;
  });

  const activeCount = cases.filter((c) => c.status !== "RESOLVED" && c.status !== "CLOSED").length;
  const highRiskCount = cases.filter((c) => c.severity === "CRITICAL" || c.severity === "HIGH").length;

  const handleCreateCase = async (e) => {
    e.preventDefault();
    if (!form.title || !form.location) return;
    setBusy(true);
    try {
      await api.post("/anti-ragging/cases", form);
      setIsCaseOpen(false);
      setForm({ title: "", description: "", location: "", severity: "HIGH", isAnonymous: true });
      queryClient.invalidateQueries({ queryKey: ["antiragging-cases"] });
    } catch (err) {
      alert(err.response?.data?.message || "Failed to log confidential anti-ragging case");
    } finally {
      setBusy(false);
    }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await api.patch(`/anti-ragging/cases/${id}/status`, { status });
      queryClient.invalidateQueries({ queryKey: ["antiragging-cases"] });
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update case status");
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!activeCase || !noteText.trim()) return;
    setBusy(true);
    try {
      await api.post(`/anti-ragging/cases/${activeCase._id}/notes`, { note: noteText.trim() });
      setIsNoteOpen(false);
      setNoteText("");
      queryClient.invalidateQueries({ queryKey: ["antiragging-cases"] });
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add confidential note");
    } finally {
      setBusy(false);
    }
  };

  const handleRecordAction = async (e) => {
    e.preventDefault();
    if (!activeCase || !actionForm.details.trim()) return;
    setBusy(true);
    try {
      await api.post(`/anti-ragging/cases/${activeCase._id}/actions`, actionForm);
      setIsActionOpen(false);
      setActionForm({ actionType: "WRITTEN_WARNING", details: "" });
      queryClient.invalidateQueries({ queryKey: ["antiragging-cases"] });
    } catch (err) {
      alert(err.response?.data?.message || "Failed to record squad action");
    } finally {
      setBusy(false);
    }
  };

  const nav = [
    { to: "/anti-ragging-dashboard", label: "Confidential Cases", icon: ShieldAlert },
  ];

  return (
    <AppShell
      product="Anti-Ragging Squad"
      roleLabel="Confidential Protection Vault"
      userName={user?.fullName || "Squad Official"}
      userSubtitle={user?.email}
      nav={nav}
    >
      <PageHeader
        title="Anti-Ragging Investigation Vault"
        description="Air-gapped confidential case tracking, victim identity protection, and disciplinary actions."
        action={
          <Button onClick={() => setIsCaseOpen(true)} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
            <Plus className="size-4" /> Open Confidential Case
          </Button>
        }
      />

      {/* Strict Confidentiality Warning Banner */}
      <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-xs font-semibold text-red-900 dark:text-red-300 flex items-start gap-3">
        <Lock className="size-5 shrink-0 text-red-600 mt-0.5" />
        <div>
          <p className="font-bold text-sm">STRICT STATUTORY CONFIDENTIALITY BARRIER</p>
          <p className="mt-0.5 opacity-90">
            Access to this vault is restricted by law to the Anti-Ragging Committee, Main Admin, and Hostel Incharge.
            General wardens, maintenance staff, and students are strictly blocked from viewing these records.
          </p>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Investigations</span>
            <AlertOctagon className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-foreground">{activeCount}</p>
          <span className="text-xs text-muted-foreground">Under active squad review</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">High Risk Cases</span>
            <ShieldAlert className="size-4 text-red-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-red-600 dark:text-red-400">{highRiskCount}</p>
          <span className="text-xs text-muted-foreground">Requires immediate disciplinary hearing</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Vault Records</span>
            <FileCheck className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-extrabold text-foreground">{cases.length}</p>
          <span className="text-xs text-muted-foreground">Encrypted audit registry</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mt-8 flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-2">Case Status:</span>
        {["ALL", "CONFIDENTIAL_REPORTED", "UNDER_INVESTIGATION", "HEARING_SCHEDULED", "ACTION_TAKEN", "CLOSED"].map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "default" : "outline"}
            onClick={() => setStatusFilter(s)}
            className="text-xs h-8 px-2.5"
          >
            {s.replace(/_/g, " ")}
          </Button>
        ))}
      </div>

      {/* Cases List */}
      <div className="mt-6 space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
            <EyeOff className="mx-auto size-8 text-muted-foreground mb-2" />
            <p className="font-semibold text-foreground">No confidential cases on record</p>
            <p className="text-xs">No active anti-ragging incident filings.</p>
          </div>
        ) : (
          filteredCases.map((c) => (
            <div
              key={c._id}
              className="rounded-xl border border-red-500/30 bg-card p-5 space-y-3 shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground">{c.title}</span>
                    <Badge variant="destructive" className="text-[10px] font-extrabold">
                      {c.severity}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {c.status.replace(/_/g, " ")}
                    </Badge>
                    {c.isAnonymous && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <EyeOff className="size-2.5" /> Anonymous Complainant
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-3">
                    <span>Location: <strong>{c.location}</strong></span>
                    <span>Logged: {new Date(c.createdAt).toLocaleString("en-IN")}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 gap-1.5"
                    onClick={() => {
                      setActiveCase(c);
                      setIsNoteOpen(true);
                    }}
                  >
                    <MessageSquare className="size-3.5" /> Note
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 gap-1.5"
                    onClick={() => {
                      setActiveCase(c);
                      setIsActionOpen(true);
                    }}
                  >
                    <FileCheck className="size-3.5" /> Record Action
                  </Button>

                  {c.status !== "RESOLVED" && (
                    <Button
                      size="sm"
                      className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleStatusUpdate(c._id, "RESOLVED")}
                    >
                      Resolve Case
                    </Button>
                  )}
                </div>
              </div>

              {c.description && (
                <p className="text-sm text-foreground/90 bg-muted/30 p-3 rounded-lg border border-border/40">
                  {c.description}
                </p>
              )}

              {/* Actions Taken Section */}
              {c.actionsTaken && c.actionsTaken.length > 0 && (
                <div className="pt-2 border-t border-border/40 space-y-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">
                    Squad Disciplinary Actions:
                  </span>
                  <div className="space-y-1">
                    {c.actionsTaken.map((act, idx) => (
                      <div key={idx} className="text-xs text-muted-foreground flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] py-0">{act.actionType}</Badge>
                        <span className="text-foreground">{act.details}</span>
                        <span className="text-[10px] opacity-70">({new Date(act.timestamp).toLocaleDateString()})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Log Case Dialog */}
      <Dialog open={isCaseOpen} onOpenChange={setIsCaseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>File Anti-Ragging Investigation Case</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCase} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="case-title">Case Title / Incident Code</Label>
              <Input
                id="case-title"
                required
                placeholder="e.g. Verbal harassment complaint Floor 2"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="case-loc">Genomic / Spatial Location</Label>
              <Input
                id="case-loc"
                required
                placeholder="e.g. Room 204 or Common Dining Area"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="case-sev">Severity Assessment</Label>
              <select
                id="case-sev"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}
              >
                <option value="CRITICAL_EMERGENCY">Critical Emergency (Immediate Suspension & FIR)</option>
                <option value="SEVERE">Severe (Formal Committee Action)</option>
                <option value="SERIOUS">Serious (Inquiry & Counseling)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="case-desc">Confidential Narrative & Statements</Label>
              <textarea
                id="case-desc"
                rows={3}
                required
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
                placeholder="Confidential case details..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsCaseOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy} className="bg-red-600 hover:bg-red-700 text-white">
                {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : null} File Vault Case
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={isNoteOpen} onOpenChange={setIsNoteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Squad Investigation Note</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddNote} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="note">Confidential Investigation Note</Label>
              <textarea
                id="note"
                rows={3}
                required
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
                placeholder="Enter confidential finding..."
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

      {/* Record Action Dialog */}
      <Dialog open={isActionOpen} onOpenChange={setIsActionOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Disciplinary Action Taken</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRecordAction} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="act-type">Action Category</Label>
              <select
                id="act-type"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={actionForm.actionType}
                onChange={(e) => setActionForm({ ...actionForm, actionType: e.target.value })}
              >
                <option value="WRITTEN_WARNING">Written Warning</option>
                <option value="PARENT_NOTIFICATION">Parent Notification</option>
                <option value="SUSPENSION">Hostel / College Suspension</option>
                <option value="EXPULSION">Expulsion</option>
                <option value="POLICE_FIR">Police FIR Filed</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="act-det">Disciplinary Committee Findings & Ruling</Label>
              <textarea
                id="act-det"
                rows={3}
                required
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
                placeholder="Record action details..."
                value={actionForm.details}
                onChange={(e) => setActionForm({ ...actionForm, details: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsActionOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy} className="bg-red-600 hover:bg-red-700 text-white">
                {busy ? <Loader2 className="size-4 animate-spin mr-1" /> : null} Record Ruling
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
