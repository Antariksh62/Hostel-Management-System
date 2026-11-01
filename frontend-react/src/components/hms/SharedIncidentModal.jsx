import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Clock,
  DoorOpen,
  Eye,
  FileCheck,
  Flame,
  Info,
  Loader2,
  ShieldAlert,
  Trash2,
  UserCheck,
  X,
  XCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import api from "@/services/api";

/**
 * SharedIncidentModal
 * Allows Wardens to inspect, confirm, assign, and resolve shared incidents
 * with explicit review decisions on all outstanding complaints.
 */
export default function SharedIncidentModal({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [complaintDecisions, setComplaintDecisions] = useState({});
  const [busyAction, setBusyAction] = useState(null);

  // Fetch all incidents
  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["all-incidents"],
    queryFn: () => api.get("/incidents").then((r) => r.data || []),
    enabled: isOpen,
  });

  const handleConfirm = async (incId) => {
    try {
      setBusyAction(incId);
      await api.put(`/incidents/${incId}/confirm`);
      queryClient.invalidateQueries({ queryKey: ["all-incidents"] });
      queryClient.invalidateQueries({ queryKey: ["service-heatmap"] });
    } catch (err) {
      console.error("Failed to confirm incident:", err);
    } finally {
      setBusyAction(null);
    }
  };

  const handleReject = async (incId) => {
    try {
      setBusyAction(incId);
      await api.put(`/incidents/${incId}/reject`);
      queryClient.invalidateQueries({ queryKey: ["all-incidents"] });
      queryClient.invalidateQueries({ queryKey: ["service-heatmap"] });
    } catch (err) {
      console.error("Failed to reject incident:", err);
    } finally {
      setBusyAction(null);
    }
  };

  const handleUnlink = async (incId, complaintId) => {
    try {
      setBusyAction(complaintId);
      await api.put(`/incidents/${incId}/unlink-complaint`, { complaintId });
      queryClient.invalidateQueries({ queryKey: ["all-incidents"] });
      queryClient.invalidateQueries({ queryKey: ["service-heatmap"] });
      if (selectedIncident?._id === incId) {
        // Refetch selected incident
        const updated = await api.get(`/incidents/${incId}`);
        setSelectedIncident(updated.data);
      }
    } catch (err) {
      console.error("Failed to unlink complaint:", err);
    } finally {
      setBusyAction(null);
    }
  };

  const handleResolve = async (incId) => {
    try {
      setBusyAction(incId);
      const decisionsList = Object.entries(complaintDecisions).map(([complaintId, action]) => ({
        complaintId,
        action,
        note: `Reviewed during closure of shared incident`,
      }));

      await api.post(`/incidents/${incId}/resolve`, {
        resolutionNote,
        complaintDecisions: decisionsList,
      });

      queryClient.invalidateQueries({ queryKey: ["all-incidents"] });
      queryClient.invalidateQueries({ queryKey: ["service-heatmap"] });
      setSelectedIncident(null);
      setResolutionNote("");
    } catch (err) {
      console.error("Failed to resolve incident:", err);
    } finally {
      setBusyAction(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-5 text-warn" />
            <h3 className="text-base font-bold tracking-tight">Shared Incident Management</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileCheck className="size-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-semibold">No active or proposed shared incidents</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                When 5 or more rooms report water or electricity issues within 10 minutes, the detector will propose an incident here for Warden review.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {incidents.map((inc) => {
                const isSelected = selectedIncident?._id === inc._id;
                const isProposed = inc.status === "PROPOSED";
                const isResolved = inc.status === "RESOLVED";
                const isRejected = inc.status === "REJECTED";

                return (
                  <div
                    key={inc._id}
                    className="rounded-xl border border-border bg-surface p-5 space-y-4 shadow-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary">
                            {inc.incidentNumber}
                          </span>
                          <span className="text-sm font-semibold text-foreground">{inc.title}</span>
                          <IncidentStatusBadge status={inc.status} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{inc.description}</p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        {isProposed ? (
                          <>
                            <Button
                              size="sm"
                              className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                              disabled={busyAction === inc._id}
                              onClick={() => handleConfirm(inc._id)}
                            >
                              <CheckCircle2 className="size-3.5" />
                              Confirm Incident
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1 text-crit hover:bg-crit/10 cursor-pointer"
                              disabled={busyAction === inc._id}
                              onClick={() => handleReject(inc._id)}
                            >
                              <XCircle className="size-3.5" />
                              Reject Grouping
                            </Button>
                          </>
                        ) : null}

                        {!isResolved && !isRejected && !isProposed ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 border-primary/40 text-primary hover:bg-primary/10 cursor-pointer"
                            onClick={() => {
                              setSelectedIncident(isSelected ? null : inc);
                              // Initialize decisions for linked complaints to RESOLVE by default
                              const defaults = {};
                              (inc.linkedComplaints || []).forEach((c) => {
                                if (c.status !== "Resolved") {
                                  defaults[c._id] = "RESOLVE";
                                }
                              });
                              setComplaintDecisions(defaults);
                            }}
                          >
                            <UserCheck className="size-3.5" />
                            {isSelected ? "Hide Review" : "Review & Close"}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {/* Affected rooms list */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground font-medium">
                        Affected Rooms ({inc.affectedRooms?.length || 0}):
                      </span>
                      {(inc.affectedRooms || []).map((rm) => (
                        <span
                          key={rm}
                          className="rounded bg-background px-2 py-0.5 font-mono text-[11px] font-semibold border border-border"
                        >
                          Room {rm}
                        </span>
                      ))}
                    </div>

                    {/* Review & Resolution Panel */}
                    {isSelected ? (
                      <div className="border-t border-border/80 pt-4 space-y-4 bg-background/50 -mx-5 -mb-5 p-5 rounded-b-xl">
                        <div className="text-xs font-bold text-foreground">
                          Review Outstanding Complaints Before Finalizing Closure
                        </div>

                        <div className="space-y-2">
                          {(inc.linkedComplaints || []).map((c) => (
                            <div
                              key={c._id}
                              className="flex items-center justify-between rounded-lg border border-border bg-card p-2.5 text-xs"
                            >
                              <div>
                                <span className="font-semibold text-foreground">
                                  Room {c.doorNumber}:
                                </span>{" "}
                                <span className="text-muted-foreground">{c.title}</span>
                                <span className="ml-2 text-[10px] text-muted-foreground">
                                  (Status: {c.status})
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                {c.status !== "Resolved" ? (
                                  <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`decision-${c._id}`}
                                        checked={complaintDecisions[c._id] === "RESOLVE"}
                                        onChange={() =>
                                          setComplaintDecisions({
                                            ...complaintDecisions,
                                            [c._id]: "RESOLVE",
                                          })
                                        }
                                      />
                                      <span className="text-emerald-500 font-medium">Resolve</span>
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`decision-${c._id}`}
                                        checked={complaintDecisions[c._id] === "KEEP_OPEN"}
                                        onChange={() =>
                                          setComplaintDecisions({
                                            ...complaintDecisions,
                                            [c._id]: "KEEP_OPEN",
                                          })
                                        }
                                      />
                                      <span className="text-warn font-medium">Keep Open</span>
                                    </label>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-emerald-500 text-[10px]">
                                    Already Resolved
                                  </Badge>
                                )}

                                <button
                                  type="button"
                                  title="Unlink from incident"
                                  onClick={() => handleUnlink(inc._id, c._id)}
                                  className="text-muted-foreground hover:text-crit cursor-pointer p-1"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground">
                            Resolution / Restoration Note:
                          </label>
                          <textarea
                            rows={2}
                            value={resolutionNote}
                            onChange={(e) => setResolutionNote(e.target.value)}
                            placeholder="e.g. Main pipeline valve repaired and water pressure tested normal."
                            className="w-full rounded-md border border-border bg-card p-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          />
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedIncident(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="bg-primary text-primary-foreground"
                            disabled={busyAction === inc._id}
                            onClick={() => handleResolve(inc._id)}
                          >
                            {busyAction === inc._id ? (
                              <Loader2 className="size-3.5 animate-spin mr-1" />
                            ) : null}
                            Finalize Incident Closure
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IncidentStatusBadge({ status }) {
  if (status === "CONFIRMED") {
    return (
      <Badge className="bg-warn/20 text-warn border-warn/40 text-[10px] font-semibold">
        Confirmed
      </Badge>
    );
  }
  if (status === "PROPOSED") {
    return (
      <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px] font-semibold animate-pulse">
        Proposed (Warden Review)
      </Badge>
    );
  }
  if (status === "RESOLVED") {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/40 text-[10px] font-semibold">
        Resolved
      </Badge>
    );
  }
  if (status === "REJECTED") {
    return (
      <Badge className="bg-muted text-muted-foreground text-[10px]">
        Rejected Grouping
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-500/20 text-blue-500 text-[10px] font-semibold">
      {status}
    </Badge>
  );
}
