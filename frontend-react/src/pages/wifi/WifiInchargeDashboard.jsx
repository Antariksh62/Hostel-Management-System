import React, { useState, useEffect, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowLeft,
  Building,
  CheckCircle2,
  Clock,
  DoorOpen,
  Eye,
  Filter,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
  X
} from "lucide-react";
import { AppShell, EmptyState, PageHeader } from "@/components/hms/app-shell";
import { Button } from "@/components/ui/button";
import AdminNotificationBell from "@/components/notifications/AdminNotificationBell";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import HostelFloorMap from "@/components/hms/HostelFloorMap";
import RoomDetailDrawer from "@/components/hms/RoomDetailDrawer";
import { AuthContext } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import api from "@/services/api";
import { cn } from "@/lib/utils";

/**
 * WifiInchargeDashboard
 * Dedicated specialist portal for the authorized networking specialist.
 * Displays all-5-floor Wi-Fi heat map, complaint triage queue, progress controls,
 * and on-demand student mobile number access.
 */
export default function WifiInchargeDashboard() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  // Wi-Fi Incharge is strictly English-only
  useEffect(() => {
    if (i18n.language !== "en") {
      i18n.changeLanguage("en");
    }
  }, [i18n]);

  const [statusFilter, setStatusFilter] = useState("ALL");
  const [floorFilter, setFloorFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [focusedFloor, setFocusedFloor] = useState(null);
  const [isQueueTableExpanded, setIsQueueTableExpanded] = useState(true);

  // Status update modal state
  const [resolvingComplaint, setResolvingComplaint] = useState(null);
  const [updateStatus, setUpdateStatus] = useState("In Progress");
  const [resolutionNote, setResolutionNote] = useState("");
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);

  // On-demand revealed contacts
  const [revealedContacts, setRevealedContacts] = useState({});
  const [loadingContactId, setLoadingContactId] = useState(null);

  // 1. Fetch Wi-Fi Heatmap
  const { data: heatmapData, isLoading: isHeatmapLoading } = useQuery({
    queryKey: ["service-heatmap", "wifi"],
    queryFn: () => api.get("/services/heat-map?service=wifi").then((r) => r.data),
  });

  // 2. Fetch Wi-Fi Complaint Queue
  const { data: queue = [], isLoading: isQueueLoading, refetch: refetchQueue, isFetching } = useQuery({
    queryKey: ["wifi-queue", statusFilter, floorFilter, searchQuery],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (floorFilter) params.append("floor", floorFilter);
      if (searchQuery) params.append("search", searchQuery);
      return api.get(`/complaints/wifi/queue?${params.toString()}`).then((r) => r.data || []);
    },
  });

  // Socket.IO real-time synchronization
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ["wifi-queue"] });
      queryClient.invalidateQueries({ queryKey: ["service-heatmap", "wifi"] });
      if (selectedRoom) {
        queryClient.invalidateQueries({ queryKey: ["room-complaints", selectedRoom] });
      }
    };

    socket.on("complaint:created", handleUpdate);
    socket.on("complaint:status-updated", handleUpdate);
    socket.on("service:heatmap-update", handleUpdate);

    return () => {
      socket.off("complaint:created", handleUpdate);
      socket.off("complaint:status-updated", handleUpdate);
      socket.off("service:heatmap-update", handleUpdate);
    };
  }, [socket, queryClient, selectedRoom]);

  const handleRevealContact = async (complaintId) => {
    try {
      setLoadingContactId(complaintId);
      const res = await api.get(`/complaints/${complaintId}/student-contact`);
      setRevealedContacts((prev) => ({
        ...prev,
        [complaintId]: res.data,
      }));
    } catch (err) {
      console.error("Failed to retrieve contact:", err);
    } finally {
      setLoadingContactId(null);
    }
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    if (!resolvingComplaint) return;

    try {
      setIsSubmittingUpdate(true);
      await api.put(`/complaints/wifi/${resolvingComplaint._id}/status`, {
        status: updateStatus,
        note: resolutionNote,
      });

      queryClient.invalidateQueries({ queryKey: ["wifi-queue"] });
      queryClient.invalidateQueries({ queryKey: ["service-heatmap", "wifi"] });
      setResolvingComplaint(null);
      setResolutionNote("");
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setIsSubmittingUpdate(false);
    }
  };

  const pendingCount = queue.filter((c) => c.status === "Pending" || c.status === "Reopened").length;
  const inProgressCount = queue.filter((c) => c.status === "In Progress").length;
  const resolvedCount = queue.filter((c) => c.status === "Resolved" || c.status === "resolved").length;

  return (
    <AppShell
      product="Hostel Networking Portal"
      roleLabel="Wi-Fi In-Charge"
      userName={user?.name || "Network Administrator"}
      userSubtitle={user?.officeLocation || "IT & Wi-Fi Operations"}
      nav={[
        { to: "/wifi-dashboard", label: "Wi-Fi Heat Map & Queue", icon: Wifi },
        ...(user?.role === "INCHARGE"
          ? [{ to: "/incharge-dashboard", label: "Operations Intelligence", icon: ArrowLeft }]
          : user?.role === "HEADWARDEN"
          ? [{ to: "/headwarden-dashboard", label: "Head Warden Portal", icon: ArrowLeft }]
          : []),
      ]}
      actions={
        <div className="flex items-center gap-1.5">
          <AdminNotificationBell />
          <Button
            variant="ghost"
            className="min-h-10 text-sm font-medium cursor-pointer"
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            {t("common.sign_out", "Sign out")}
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <PageHeader
            title="Wi-Fi Operations Dashboard"
            description="Real-time connectivity monitoring, spatial heat map across all 77 rooms, and troubleshooting queue."
          />

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            onClick={() => refetchQueue()}
          >
            <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <span className="text-xs font-semibold text-muted-foreground">Total Tickets</span>
            <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{queue.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">All Wi-Fi complaints</div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <span className="text-xs font-semibold text-warn">New / Pending</span>
            <div className="mt-2 text-2xl font-bold tracking-tight text-warn">{pendingCount}</div>
            <div className="mt-1 text-xs text-muted-foreground">Awaiting inspection</div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <span className="text-xs font-semibold text-blue-500">In Troubleshooting</span>
            <div className="mt-2 text-2xl font-bold tracking-tight text-blue-500">{inProgressCount}</div>
            <div className="mt-1 text-xs text-muted-foreground">Assigned & in-progress</div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <span className="text-xs font-semibold text-emerald-500">Resolved</span>
            <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-500">{resolvedCount}</div>
            <div className="mt-1 text-xs text-muted-foreground">Verified restored</div>
          </div>
        </div>

        {/* All-5-Floor Wi-Fi Heat Map */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold tracking-tight">Boys' Hostel Wi-Fi Heat Map</h2>
              <p className="text-xs text-muted-foreground">
                Click any room to view its Wi-Fi signal reports and contact resident.
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded border border-border bg-card" />
                <span className="text-muted-foreground">No reports</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded border border-warn bg-warn/20" />
                <span className="text-muted-foreground">1 report</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-3 rounded border border-crit bg-crit/20" />
                <span className="text-muted-foreground">2+ reports</span>
              </div>
            </div>
          </div>

          {isHeatmapLoading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (
            <HostelFloorMap
              selectedService="wifi"
              roomStats={heatmapData?.roomStats || {}}
              selectedRoom={selectedRoom}
              onSelectRoom={(roomId) => {
                setSelectedRoom(roomId);
                setIsDrawerOpen(true);
              }}
              focusedFloor={focusedFloor}
              onFocusFloor={setFocusedFloor}
            />
          )}
        </div>

        {/* Wi-Fi Complaint Triage Queue */}
        <div className="space-y-4 border-t border-border pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold tracking-tight">Wi-Fi Trouble Queue</h2>
              <p className="text-xs text-muted-foreground">
                Individual student reports awaiting network diagnosis or resolution.
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search room (e.g. 101)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8.5 rounded-lg border border-border bg-background pl-8 pr-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary w-44"
                />
              </div>

              {/* Floor Filter */}
              <select
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                className="h-8.5 rounded-lg border border-border bg-background px-2.5 text-xs focus-visible:outline-none cursor-pointer"
              >
                <option value="">All Floors</option>
                <option value="1">Floor 1 (101–117)</option>
                <option value="2">Floor 2 (201–217)</option>
                <option value="3">Floor 3 (301–317)</option>
                <option value="4">Floor 4 (401–417)</option>
                <option value="5">Floor 5 (501–509)</option>
              </select>

              {/* Status Filter */}
              <div className="flex items-center rounded-lg border border-border bg-background p-0.5 text-xs">
                {["ALL", "Pending", "In Progress", "Resolved"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      "rounded px-2.5 py-1 text-xs font-medium cursor-pointer transition-colors",
                      statusFilter === st
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {st === "ALL" ? "All" : st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Issue-First Grouped Service Presentation */}
          {!isQueueLoading && queue.length > 0 && (() => {
            const distinctRooms = new Set(queue.map((q) => q.doorNumber).filter(Boolean));
            const affectedFloors = new Set([...distinctRooms].map((r) => String(r).charAt(0)));
            return (
              <div className="rounded-xl border border-primary/20 bg-card p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                      <Wifi className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-foreground">
                          Campus Wi-Fi Trouble Group — Consolidated Specialised View
                        </h3>
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                          {statusFilter === "ALL" ? "All Active Tickets" : statusFilter}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Grouped network incident view across hostel premises
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-9"
                    onClick={() => setIsQueueTableExpanded(!isQueueTableExpanded)}
                  >
                    {isQueueTableExpanded
                      ? "Hide Individual Queue Table"
                      : `View All Individual Reports & Histories (${queue.length})`}
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-center">
                    <div className="text-xl sm:text-2xl font-extrabold text-foreground">{queue.length}</div>
                    <div className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                      Total Reports
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-center">
                    <div className="text-xl sm:text-2xl font-extrabold text-foreground">{distinctRooms.size}</div>
                    <div className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                      Distinct Rooms
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-center">
                    <div className="text-xl sm:text-2xl font-extrabold text-foreground">{affectedFloors.size}</div>
                    <div className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                      Floors ({Array.from(affectedFloors).sort().map((f) => `F${f}`).join(", ")})
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Queue Table */}
          {isQueueLoading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : queue.length === 0 ? (
            <EmptyState
              icon={WifiOff}
              title="No Wi-Fi complaints match filter"
              description="No Wi-Fi troubleshooting tickets found matching your current filter criteria."
            />
          ) : isQueueTableExpanded && (
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="border-b border-border bg-surface text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-3">Room</th>
                      <th className="px-4 py-3">Student & PRN</th>
                      <th className="px-4 py-3">Report Details</th>
                      <th className="px-4 py-3">Time</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {queue.map((item) => {
                      const contact = revealedContacts[item._id];
                      const isContactLoading = loadingContactId === item._id;

                      return (
                        <tr key={item._id} className="hover:bg-surface/50 transition-colors">
                          <td className="px-4 py-3 font-bold text-foreground">
                            <span className="rounded bg-secondary px-2 py-0.5 text-primary">
                              Room {item.doorNumber}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-semibold text-foreground">
                              {item.studentId?.fullName || item.studentId?.name || "Student"}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {item.studentId?.prn || "PRN Unavailable"}
                            </div>
                          </td>

                          <td className="px-4 py-3 max-w-xs">
                            <div className="font-medium text-foreground">{item.title}</div>
                            {item.description ? (
                              <p className="text-[11px] text-muted-foreground line-clamp-1">
                                {item.description}
                              </p>
                            ) : null}
                          </td>

                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString()}
                            <div className="text-[10px]">
                              {new Date(item.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <QueueStatusBadge status={item.status} />
                          </td>

                          <td className="px-4 py-3">
                            {contact ? (
                              <div className="flex items-center gap-1 font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded w-fit text-[11px]">
                                <Phone className="size-3" />
                                <span>{contact.mobileNumber}</span>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] gap-1 cursor-pointer"
                                disabled={isContactLoading}
                                onClick={() => handleRevealContact(item._id)}
                              >
                                {isContactLoading ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Eye className="size-3" />
                                )}
                                View Mobile
                              </Button>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                              onClick={() => {
                                setResolvingComplaint(item);
                                setUpdateStatus(item.status === "Pending" ? "In Progress" : "Resolved");
                              }}
                            >
                              Update
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Slide-out Room Detail Drawer */}
      <RoomDetailDrawer
        roomNumber={selectedRoom}
        selectedService="wifi"
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedRoom(null);
        }}
        canRevealContact={true}
      />

      {/* Status Update Modal */}
      {resolvingComplaint ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold">Update Wi-Fi Complaint</h3>
              <button
                type="button"
                onClick={() => setResolvingComplaint(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="text-xs space-y-1">
              <div>
                <span className="text-muted-foreground">Location:</span>{" "}
                <span className="font-semibold text-foreground">Room {resolvingComplaint.doorNumber}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Issue:</span>{" "}
                <span className="font-semibold text-foreground">{resolvingComplaint.title}</span>
              </div>
            </div>

            <form onSubmit={handleStatusSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Status:</label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface p-2 text-xs focus-visible:outline-none"
                >
                  <option value="Pending">Pending (Under Queue)</option>
                  <option value="In Progress">In Progress (Diagnosing)</option>
                  <option value="Resolved">Resolved (Connectivity Restored)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Troubleshooting Note:</label>
                <textarea
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="e.g. Access point rebooted, signal verified at 54Mbps."
                  className="w-full rounded-md border border-border bg-surface p-2 text-xs focus-visible:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setResolvingComplaint(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-primary text-primary-foreground"
                  disabled={isSubmittingUpdate}
                >
                  {isSubmittingUpdate ? <Loader2 className="size-3.5 animate-spin mr-1" /> : null}
                  Save Progress
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function QueueStatusBadge({ status }) {
  if (status === "Resolved" || status === "resolved") {
    return (
      <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 text-[10px] font-semibold">
        Resolved
      </Badge>
    );
  }
  if (status === "In Progress") {
    return (
      <Badge variant="outline" className="text-blue-500 border-blue-500/30 bg-blue-500/10 text-[10px] font-semibold">
        In Progress
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-warn border-warn/30 bg-warn/10 text-[10px] font-semibold">
      Pending
    </Badge>
  );
}
