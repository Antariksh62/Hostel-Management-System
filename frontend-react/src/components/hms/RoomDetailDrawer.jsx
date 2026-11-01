import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  DoorOpen,
  Eye,
  Loader2,
  Phone,
  ShieldAlert,
  User,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import api from "@/services/api";

/**
 * RoomDetailDrawer
 * Slide-out room detail panel displaying service complaints, status timeline,
 * shared incidents, and authorized on-demand student mobile number retrieval.
 */
export default function RoomDetailDrawer({
  roomNumber,
  selectedService = "all",
  isOpen,
  onClose,
  canRevealContact = false,
}) {
  const [revealedContacts, setRevealedContacts] = useState({});
  const [loadingContactId, setLoadingContactId] = useState(null);

  // Fetch room complaints from backend
  const { data, isLoading } = useQuery({
    queryKey: ["room-complaints", roomNumber, selectedService],
    queryFn: () =>
      api
        .get(`/services/room/${roomNumber}/complaints?service=${selectedService}`)
        .then((r) => r.data),
    enabled: Boolean(isOpen && roomNumber),
  });

  const complaints = data?.complaints || [];
  const activeIncidents = data?.activeIncidents || [];

  const handleRevealContact = async (complaintId) => {
    try {
      setLoadingContactId(complaintId);
      const res = await api.get(`/complaints/${complaintId}/student-contact`);
      setRevealedContacts((prev) => ({
        ...prev,
        [complaintId]: res.data,
      }));
    } catch (err) {
      console.error("Failed to retrieve student contact:", err);
    } finally {
      setLoadingContactId(null);
    }
  };

  if (!isOpen) return null;

  const floorNumber = roomNumber ? roomNumber.charAt(0) : "1";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-fade-in">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Body */}
      <div className="relative z-10 flex h-full w-full max-w-full sm:max-w-lg flex-col border-l border-border bg-card p-4 sm:p-6 shadow-2xl transition-transform">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border/80 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                {roomNumber}
              </span>
              <h2 className="text-lg font-bold tracking-tight">Room {roomNumber} Details</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Floor {floorNumber} · Showing {selectedService === "all" ? "all services" : selectedService} reports
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5">
          {/* Active Incidents Banner */}
          {activeIncidents.length > 0 ? (
            <div className="rounded-lg border border-warn/40 bg-warn/10 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-warn">
                <ShieldAlert className="size-4" />
                Active Shared Incident in this Room
              </div>
              {activeIncidents.map((inc) => (
                <div key={inc._id} className="text-xs space-y-0.5">
                  <div className="font-medium text-foreground">
                    {inc.incidentNumber}: {inc.title}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Status: <span className="font-semibold text-warn">{inc.status}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Loading state */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="size-6 animate-spin mb-2" />
              <span className="text-xs">Loading reports for Room {roomNumber}...</span>
            </div>
          ) : complaints.length === 0 ? (
            /* Honest Empty State */
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 px-4 text-center">
              <DoorOpen className="size-8 text-muted-foreground/60 mb-2" />
              <h4 className="text-sm font-semibold">No active reports for Room {roomNumber}</h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                No active or historical reports found for the selected service filter in this room.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Total Reports: {complaints.length}</span>
                <span>
                  Unresolved:{" "}
                  {
                    complaints.filter((c) => c.status !== "Resolved" && c.status !== "resolved").length
                  }
                </span>
              </div>

              {complaints.map((c) => {
                const contact = revealedContacts[c._id];
                const isContactLoading = loadingContactId === c._id;

                return (
                  <div
                    key={c._id}
                    className="rounded-lg border border-border bg-surface p-3.5 space-y-2.5 shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">{c.title}</h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          <span className="font-medium text-primary">
                            {c.quickCategory || c.category}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {new Date(c.createdAt).toLocaleDateString()} at{" "}
                            {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>

                      <StatusBadge status={c.status} />
                    </div>

                    {c.description ? (
                      <p className="text-xs text-foreground/85 line-clamp-2">{c.description}</p>
                    ) : null}

                    {/* Incident Link */}
                    {c.incidentId ? (
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 bg-background/60 px-2 py-1 rounded">
                        <ShieldAlert className="size-3 text-warn" />
                        <span>Part of Incident:</span>
                        <span className="font-semibold text-foreground">
                          {c.incidentId.incidentNumber}
                        </span>
                      </div>
                    ) : null}

                    {/* Student Info & Authorized Contact Reveal */}
                    <div className="border-t border-border/60 pt-2 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="size-3.5" />
                        <span>
                          {c.studentId?.fullName || c.studentId?.name || "Student"} ({c.studentId?.prn || "PRN"})
                        </span>
                      </div>

                      {canRevealContact ? (
                        contact ? (
                          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">
                            <Phone className="size-3" />
                            <span>{contact.mobileNumber}</span>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] gap-1 cursor-pointer"
                            disabled={isContactLoading}
                            onClick={() => handleRevealContact(c._id)}
                          >
                            {isContactLoading ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Eye className="size-3" />
                            )}
                            View Mobile
                          </Button>
                        )
                      ) : null}
                    </div>
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

function StatusBadge({ status }) {
  if (status === "Resolved" || status === "resolved") {
    return (
      <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500 font-semibold text-[10px]">
        Resolved
      </Badge>
    );
  }
  if (status === "In Progress") {
    return (
      <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-500 font-semibold text-[10px]">
        In Progress
      </Badge>
    );
  }
  if (status === "Reopened") {
    return (
      <Badge variant="outline" className="border-crit/30 bg-crit/10 text-crit font-semibold text-[10px]">
        Reopened
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-warn/30 bg-warn/10 text-warn font-semibold text-[10px]">
      Pending
    </Badge>
  );
}
