import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Droplets, Layers, Loader2, UserPlus, Zap } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { EmptyState, PageHeader } from "@/components/hms/app-shell";
import { ComplaintCard } from "@/components/hms/complaint-card";
import { ComplaintHeader, ComplaintMeta, DetailSection, ResolutionSummary } from "@/components/hms/complaint-detail";
import { ComplaintTimeline } from "@/components/hms/complaint-timeline";
import { MediaGallery } from "@/components/hms/media-gallery";
import { formatDateTime } from "@/components/hms/status";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useSocket } from "@/context/SocketContext";
import { translateComplaintText } from "@/utils/complaintTranslator";
import api from "@/services/api";

const STATUS_FILTERS = [
  { value: "all", label: "All status" },
  { value: "Pending", label: "Pending" },
  { value: "In Progress", label: "In Progress" },
  { value: "Resolved", label: "Resolved" },
  { value: "Reopened", label: "Reopened" },
];

const TIME_FILTERS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "Last 7 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "custom", label: "Specific month..." },
];

export default function WardenComplaints() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentLang = i18n.language || "en";
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const urlStatus = searchParams.get("status");
  const urlTime = searchParams.get("time");
  const urlCategory = searchParams.get("category");
  const urlOverdue = searchParams.get("overdue") === "true";

  const [statusFilter, setStatusFilter] = useState(urlStatus || "all");
  const [timeFilter, setTimeFilter] = useState(urlTime || "all");
  const [categoryFilter, setCategoryFilter] = useState(urlCategory || "all");
  const [overdueOnly, setOverdueOnly] = useState(urlOverdue);
  const [customMonth, setCustomMonth] = useState("");
  const [selected, setSelected] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});

  // Sync with URL query parameter changes
  useEffect(() => {
    const s = searchParams.get("status");
    if (s && s !== statusFilter) {
      setStatusFilter(s);
    } else if (!s && statusFilter !== "all") {
      setStatusFilter("all");
    }

    const tm = searchParams.get("time");
    if (tm && tm !== timeFilter) {
      setTimeFilter(tm);
    } else if (!tm && timeFilter !== "all") {
      setTimeFilter("all");
    }

    const cat = searchParams.get("category");
    if (cat && cat !== categoryFilter) {
      setCategoryFilter(cat);
    } else if (!cat && categoryFilter !== "all") {
      setCategoryFilter("all");
    }

    const ov = searchParams.get("overdue") === "true";
    if (ov !== overdueOnly) {
      setOverdueOnly(ov);
    }
  }, [searchParams]);

  // Query all complaints
  const { data: complaints = [], isLoading: cLoading } = useQuery({
    queryKey: ["warden-complaints"],
    queryFn: () => api.get("/complaints/all").then((r) => r.data || []),
  });

  // Query staff members for assignment
  const { data: staffList = [] } = useQuery({
    queryKey: ["warden-staff-list"],
    queryFn: () => api.get("/users/staff").then((r) => r.data || []),
  });

  // Real-time socket sync
  useEffect(() => {
    if (!socket) return;

    const handleCreated = () => queryClient.invalidateQueries({ queryKey: ["warden-complaints"] });
    const handleUpdated = () => queryClient.invalidateQueries({ queryKey: ["warden-complaints"] });
    const handleAssigned = () => queryClient.invalidateQueries({ queryKey: ["warden-complaints"] });
    const handleDeleted = () => queryClient.invalidateQueries({ queryKey: ["warden-complaints"] });

    socket.on("complaint:created", handleCreated);
    socket.on("complaint:status-updated", handleUpdated);
    socket.on("complaint:assigned", handleAssigned);
    socket.on("complaint:deleted", handleDeleted);

    return () => {
      socket.off("complaint:created", handleCreated);
      socket.off("complaint:status-updated", handleUpdated);
      socket.off("complaint:assigned", handleAssigned);
      socket.off("complaint:deleted", handleDeleted);
    };
  }, [socket, queryClient]);

  // Assign staff handler
  async function handleAssign(complaintId, staffId) {
    try {
      await api.patch(`/complaints/${complaintId}/assign`, { staffId });
      const assignedPerson = staffList.find((s) => (s._id || s.id) === staffId);
      toast.success(`Assigned to ${assignedPerson?.name || "staff"}`);
      queryClient.invalidateQueries({ queryKey: ["warden-complaints"] });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign staff.");
    }
  }

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filtered = complaints.filter((c) => {
    // 1. Status Filter
    if (statusFilter !== "all") {
      const s = (c.status || "").toLowerCase();
      const f = statusFilter.toLowerCase();
      if (f === "in progress") {
        if (s !== "in progress" && s !== "in_progress" && s !== "assigned") return false;
      } else if (f === "pending") {
        if (s !== "pending" && s !== "submitted") return false;
      } else if (s !== f) {
        return false;
      }
    }

    // 2. Overdue Filter (>48h SLA breach)
    if (overdueOnly) {
      const s = (c.status || "").toLowerCase();
      if (s === "resolved") return false;
      const dateStr = c.createdAt;
      if (!dateStr) return false;
      const hoursElapsed = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
      if (hoursElapsed < 48) return false;
    }

    // 3. Category Filter
    if (categoryFilter !== "all") {
      const cCat = (c.category || "").toLowerCase();
      const targetCat = categoryFilter.toLowerCase();
      if (cCat !== targetCat) return false;
    }

    // 4. Time / Date Filter
    if (timeFilter !== "all") {
      const dateStr = c.createdAt;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      const now = new Date();

      if (timeFilter === "today") {
        const isToday =
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate();
        if (!isToday) return false;
      } else if (timeFilter === "yesterday") {
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const isYesterday =
          d.getFullYear() === yesterday.getFullYear() &&
          d.getMonth() === yesterday.getMonth() &&
          d.getDate() === yesterday.getDate();
        if (!isYesterday) return false;
      } else if (timeFilter === "week") {
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        if (d < sevenDaysAgo || d > now) return false;
      } else if (timeFilter === "this_month") {
        const isThisMonth =
          d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        if (!isThisMonth) return false;
      } else if (timeFilter === "last_month") {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const isLastMonth =
          d.getFullYear() === lastMonth.getFullYear() &&
          d.getMonth() === lastMonth.getMonth();
        if (!isLastMonth) return false;
      } else if (timeFilter === "custom" && customMonth) {
        const [year, month] = customMonth.split("-").map(Number);
        const isCustom = d.getFullYear() === year && d.getMonth() === month - 1;
        if (!isCustom) return false;
      }
    }

    return true;
  });

  // Issue-first grouping logic
  const { groups, standalone } = useMemo(() => {
    const groupMap = new Map();
    const singles = [];

    filtered.forEach((c) => {
      let groupKey = null;
      if (c.incidentId) {
        const incId = typeof c.incidentId === "object" ? (c.incidentId._id || c.incidentId.id) : c.incidentId;
        groupKey = `incident_${incId}`;
      } else if (c.quickCategory) {
        groupKey = `quick_${c.quickCategory}`;
      } else if (c.parentComplaintId) {
        groupKey = `parent_${c.parentComplaintId}`;
      }

      if (groupKey) {
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, []);
        }
        groupMap.get(groupKey).push(c);
      } else {
        singles.push(c);
      }
    });

    const activeGroups = [];
    groupMap.forEach((items, key) => {
      if (items.length > 1) {
        const distinctRooms = new Set(
          items
            .map((c) => c.doorNumber || (typeof c.studentId === "object" ? c.studentId?.doorNumber : null))
            .filter(Boolean)
        );
        const affectedFloors = new Set([...distinctRooms].map((r) => String(r).charAt(0)));
        const first = items[0];

        let title = "Grouped Service Issue";
        if (first.quickCategory === "NO_WATER_SUPPLY" || first.category === "Plumbing") {
          title = "Grouped Service Issue: Water Supply Outage";
        } else if (first.quickCategory === "NO_ELECTRICITY" || first.category === "Electrical") {
          title = "Grouped Service Issue: Electricity Outage";
        } else if (first.incidentId?.title) {
          title = `Grouped Incident: ${first.incidentId.title}`;
        } else {
          title = `Grouped Issue: ${first.title || first.category}`;
        }

        activeGroups.push({
          key,
          title,
          category: first.category,
          quickCategory: first.quickCategory,
          incidentId: first.incidentId,
          complaints: items,
          totalReports: items.length,
          distinctRoomsCount: distinctRooms.size,
          rooms: Array.from(distinctRooms).sort(),
          affectedFloorsCount: affectedFloors.size,
          floors: Array.from(affectedFloors).sort(),
          status: items.every((c) => c.status === "Resolved")
            ? "Resolved"
            : items.some((c) => c.status === "In Progress")
            ? "In Progress"
            : "Active",
        });
      } else {
        singles.push(items[0]);
      }
    });

    return { groups: activeGroups, standalone: singles };
  }, [filtered]);

  const renderComplaintCard = (c) => {
    const studentObj = typeof c.studentId === "object" ? c.studentId : null;
    const studentName = studentObj?.fullName || studentObj?.name || t("auth.student_tab", "Student");
    const prn = studentObj?.prn || studentObj?.rollNumber || "—";
    const assignedName = c.assignedTo?.name || t("complaints.unassigned", "Unassigned");
    const isResolved = c.status === "Resolved" || c.status === "resolved";

    return (
      <ComplaintCard
        key={c._id || c.id}
        complaint={c}
        meta={
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>
              {t("auth.student_tab", "Student")}: <strong className="font-semibold text-foreground">{studentName}</strong> (PRN: <span className="font-mono">{prn}</span>)
            </span>
            <span>
              {t("complaints.assigned_to", "Assigned")}: <strong className="text-foreground">{assignedName}</strong>
            </span>
          </div>
        }
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="min-h-10 text-xs"
                onClick={() => setSelected(c)}
              >
                {t("common.view", "View details")}
              </Button>
            </div>

            {!isResolved && (
              <div className="w-full sm:w-56">
                <Select
                  value={c.assignedTo?._id || c.assignedTo || ""}
                  onValueChange={(staffId) => handleAssign(c._id, staffId)}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder={t("complaints.assign_staff_btn", "Assign maintenance staff")} />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList.map((s) => (
                      <SelectItem key={s._id || s.id} value={s._id || s.id}>
                        {s.name} ({s.email?.split("@")[0] || "Staff"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        }
      />
    );
  };

  const totalDisplayedItems = groups.length + standalone.length;

  return (
    <>
      <PageHeader
        title={t("nav.complaints", "Complaints Management")}
        description={`${totalDisplayedItems} ${t("common.results", "views")} (${filtered.length} ${t("complaints.all_complaints", "total reports")})`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="h-10 w-36 sm:w-40 text-xs">
                <SelectValue placeholder="All time" />
              </SelectTrigger>
              <SelectContent>
                {TIME_FILTERS.map((tf) => (
                  <SelectItem key={tf.value} value={tf.value}>
                    {tf.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {timeFilter === "custom" && (
              <Input
                type="month"
                value={customMonth}
                onChange={(e) => setCustomMonth(e.target.value)}
                className="h-10 w-36 text-xs"
              />
            )}

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-36 sm:w-40 text-xs">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Active Filter Indicators */}
      {(overdueOnly || categoryFilter !== "all" || statusFilter !== "all" || timeFilter !== "all") && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/40 p-2.5 text-xs text-muted-foreground border border-border/50">
          <span className="font-semibold text-foreground">Active filter:</span>
          {overdueOnly && (
            <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 font-bold">
              Overdue (&gt;48h)
            </Badge>
          )}
          {categoryFilter !== "all" && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              Category: {categoryFilter}
            </Badge>
          )}
          {statusFilter !== "all" && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              Status: {statusFilter}
            </Badge>
          )}
          {timeFilter !== "all" && (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              Time: {timeFilter === "today" ? "Last 24h / Today" : timeFilter}
            </Badge>
          )}
          <button
            type="button"
            onClick={() => {
              setStatusFilter("all");
              setTimeFilter("all");
              setCategoryFilter("all");
              setOverdueOnly(false);
              setSearchParams({ tab: searchParams.get("tab") || "complaints" });
            }}
            className="ml-auto text-xs text-primary hover:underline font-semibold cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      )}

      {cLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="No complaints matching filter"
          description="Try changing the status or time filters above."
        />
      ) : (
        <div className="space-y-4">
          {/* Issue-First Grouped Service Issues */}
          {groups.map((g) => {
            const isWater = g.quickCategory === "NO_WATER_SUPPLY" || g.category === "Plumbing";
            const Icon = isWater ? Droplets : Zap;
            const isExpanded = Boolean(expandedGroups[g.key]);

            return (
              <div
                key={g.key}
                className="rounded-xl border border-primary/20 bg-card p-4 sm:p-5 shadow-xs space-y-4 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-foreground">{g.title}</h3>
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                          {g.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Consolidated incident view across hostel premises
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-9"
                      onClick={() => toggleGroup(g.key)}
                    >
                      <Layers className="size-3.5 mr-1.5" />
                      {isExpanded ? "Hide Individual Reports" : `View ${g.totalReports} Individual Reports & Histories`}
                      {isExpanded ? <ChevronUp className="size-3.5 ml-1" /> : <ChevronDown className="size-3.5 ml-1" />}
                    </Button>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-center">
                    <div className="text-xl sm:text-2xl font-extrabold text-foreground">{g.totalReports}</div>
                    <div className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                      Total Reports
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-center">
                    <div className="text-xl sm:text-2xl font-extrabold text-foreground">{g.distinctRoomsCount}</div>
                    <div className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                      Distinct Rooms
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-center">
                    <div className="text-xl sm:text-2xl font-extrabold text-foreground">{g.affectedFloorsCount}</div>
                    <div className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wider mt-0.5">
                      Floors ({g.floors.map((f) => `F${f}`).join(", ")})
                    </div>
                  </div>
                </div>

                {/* Expanded Individual Reports */}
                {isExpanded && (
                  <div className="space-y-3 pt-3 border-t border-border/60">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Individual Report Records ({g.totalReports})
                      </h4>
                    </div>
                    <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                      {g.complaints.map((c) => renderComplaintCard(c))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Standalone Individual Complaints */}
          {standalone.map((c) => renderComplaintCard(c))}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {selected && (
            <div className="space-y-6">
              <DialogHeader>
                <ComplaintHeader complaint={selected} />
              </DialogHeader>

              <ComplaintMeta
                items={[
                  { label: t("common.room", "Room"), value: `${t("common.room", "Room")} ${selected.doorNumber || selected.room || selected.studentId?.doorNumber || "—"}` },
                  { label: t("complaints.category", "Category"), value: t(`categories.${selected.category}`, selected.category) },
                  { label: t("complaints.reported_on", "Reported"), value: formatDateTime(selected.createdAt) },
                  {
                    label: t("auth.student_tab", "Student"),
                    value: selected.studentId?.fullName || selected.studentId?.name || t("auth.student_tab", "Student"),
                  },
                  {
                    label: "PRN",
                    value: (
                      <span className="font-mono font-medium">
                        {selected.studentId?.prn || selected.studentId?.rollNumber || "—"}
                      </span>
                    ),
                  },
                  { label: t("complaints.assigned_to", "Assigned Staff"), value: selected.assignedTo?.name || t("complaints.unassigned", "Unassigned") },
                  {
                    label: t("staff.email_address", "Email"),
                    value: selected.studentId?.email || "—",
                  },
                ]}
              />

              <DetailSection title={t("complaints.description", "Description")}>
                <p className="text-sm leading-relaxed text-foreground">
                  {translateComplaintText(selected.description, currentLang)}
                </p>
              </DetailSection>

              {(selected.media?.length > 0 || selected.attachments?.length > 0 || selected.image) && (
                <DetailSection title={t("complaints.upload_media", "Evidence Photos / Video")}>
                  <MediaGallery
                    media={selected.media}
                    image={selected.image}
                    attachments={selected.attachments}
                  />
                </DetailSection>
              )}

              <DetailSection title={t("dashboard.live_lifecycle", "Timeline & Status Lifecycle")}>
                <ComplaintTimeline complaint={selected} variant="staff" />
              </DetailSection>

              <ResolutionSummary complaint={selected} />

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  {t("common.close", "Close")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
