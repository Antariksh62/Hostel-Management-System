import React, { useContext, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  History,
  Layers,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  User,
  UserCheck,
  Users,
  Wrench,
  X
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AuthContext } from "@/context/AuthContext";
import api from "@/services/api";

const CATEGORIES_GENERAL = ["Electrical", "Plumbing", "Furniture", "Cleanliness", "Other"];

export default function StaffPerformanceAnalytics() {
  const { user } = useContext(AuthContext);
  const isWarden = user?.role === "WARDEN";

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedFloor, setSelectedFloor] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedOutcome, setSelectedOutcome] = useState("ALL");
  const [searchStaff, setSearchStaff] = useState("");
  const [dateRange, setDateRange] = useState("ALL"); // ALL | 7D | 30D | CUSTOM
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Drilldown state
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);

  // Compute date params
  const dateParams = useMemo(() => {
    const p = {};
    const now = new Date();
    if (dateRange === "7D") {
      const d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      p.startDate = d.toISOString();
    } else if (dateRange === "30D") {
      const d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      p.startDate = d.toISOString();
    } else if (dateRange === "CUSTOM") {
      if (customStart) p.startDate = new Date(customStart).toISOString();
      if (customEnd) p.endDate = new Date(customEnd).toISOString();
    }
    return p;
  }, [dateRange, customStart, customEnd]);

  // Query overview KPI metrics
  const { data: overviewData, isLoading: isOverviewLoading, refetch: refetchOverview } = useQuery({
    queryKey: ["staff-analytics-overview", selectedCategory, selectedFloor, selectedStatus, selectedOutcome, dateParams],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "ALL") params.append("category", selectedCategory);
      if (selectedFloor !== "ALL") params.append("floor", selectedFloor);
      if (selectedStatus !== "ALL") params.append("status", selectedStatus);
      if (selectedOutcome !== "ALL") params.append("outcome", selectedOutcome);
      if (dateParams.startDate) params.append("startDate", dateParams.startDate);
      if (dateParams.endDate) params.append("endDate", dateParams.endDate);
      return api.get(`/staff-analytics/overview?${params.toString()}`).then((r) => r.data);
    },
  });

  // Query staff breakdown table
  const { data: staffTableData, isLoading: isTableLoading, refetch: refetchTable } = useQuery({
    queryKey: ["staff-analytics-table", selectedCategory, selectedFloor, selectedStatus, dateParams],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "ALL") params.append("category", selectedCategory);
      if (selectedFloor !== "ALL") params.append("floor", selectedFloor);
      if (selectedStatus !== "ALL") params.append("status", selectedStatus);
      if (dateParams.startDate) params.append("startDate", dateParams.startDate);
      if (dateParams.endDate) params.append("endDate", dateParams.endDate);
      return api.get(`/staff-analytics/staff-table?${params.toString()}`).then((r) => r.data);
    },
  });

  // Query drilldown complaints when a staff member is selected
  const { data: drilldownData, isLoading: isDrilldownLoading } = useQuery({
    queryKey: ["staff-drilldown", selectedStaff?.staffId, selectedCategory, selectedFloor, dateParams],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "ALL") params.append("category", selectedCategory);
      if (selectedFloor !== "ALL") params.append("floor", selectedFloor);
      if (dateParams.startDate) params.append("startDate", dateParams.startDate);
      if (dateParams.endDate) params.append("endDate", dateParams.endDate);
      return api.get(`/staff-analytics/staff/${selectedStaff.staffId}/complaints?${params.toString()}`).then((r) => r.data);
    },
    enabled: Boolean(selectedStaff),
  });

  // Query single complaint timeline
  const { data: timelineData, isLoading: isTimelineLoading } = useQuery({
    queryKey: ["complaint-timeline", selectedComplaintId],
    queryFn: () => api.get(`/staff-analytics/complaint/${selectedComplaintId}/timeline`).then((r) => r.data),
    enabled: Boolean(selectedComplaintId),
  });

  const overview = overviewData?.overview || {};
  const staffList = staffTableData?.staff || [];

  // Filter staff table by name/role search
  const filteredStaff = useMemo(() => {
    if (!searchStaff.trim()) return staffList;
    const q = searchStaff.toLowerCase();
    return staffList.filter(
      (s) => s.name?.toLowerCase().includes(q) || s.staffRole?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
    );
  }, [staffList, searchStaff]);

  return (
    <div className="space-y-6">
      {/* 1. Header with Refresh & Context */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="size-5 text-primary" />
              Staff Performance & Resolution Analytics
            </h2>
            <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
              Persisted Lifecycle Audit
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Tracks first-attempt resolution outcomes, student confirmations, reopens, and workload attribution.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchOverview();
              refetchTable();
            }}
            className="flex items-center gap-1.5 text-xs cursor-pointer"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <Filter className="size-3.5 text-primary" />
          <span>Operational Filters</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Date Range */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">Time Horizon</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full text-xs rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Time</option>
              <option value="7D">Past 7 Days</option>
              <option value="30D">Past 30 Days</option>
              <option value="CUSTOM">Custom Range</option>
            </select>
          </div>

          {/* Category Filter (Wi-Fi strictly excluded for Warden) */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Categories</option>
              {CATEGORIES_GENERAL.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Floor Filter */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">Floor</label>
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="w-full text-xs rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Floors</option>
              <option value="1">Floor 1 (101–117)</option>
              <option value="2">Floor 2 (201–217)</option>
              <option value="3">Floor 3 (301–317)</option>
              <option value="4">Floor 4 (401–417)</option>
              <option value="5">Floor 5 (501–509)</option>
            </select>
          </div>

          {/* Outcome Filter */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">First-Attempt Outcome</label>
            <select
              value={selectedOutcome}
              onChange={(e) => setSelectedOutcome(e.target.value)}
              className="w-full text-xs rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Outcomes</option>
              <option value="FIRST_ATTEMPT_SUCCESS">First-Attempt Success</option>
              <option value="NOT_SOLVED_FIRST_TRY">Not Solved on First Try</option>
              <option value="AWAITING_CONFIRMATION">Awaiting Confirmation</option>
              <option value="PENDING">Pending First Attempt</option>
              <option value="UNKNOWN">Historical / Unknown (Legacy)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">Current Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs rounded-md border border-border bg-background px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Reopened">Reopened</option>
            </select>
          </div>

          {/* Search Staff */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium block mb-1">Search Staff</label>
            <div className="relative">
              <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Name or role..."
                value={searchStaff}
                onChange={(e) => setSearchStaff(e.target.value)}
                className="w-full text-xs rounded-md border border-border bg-background pl-8 pr-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {dateRange === "CUSTOM" && (
          <div className="flex items-center gap-3 pt-2 border-t border-border/60">
            <span className="text-xs text-muted-foreground">From:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="text-xs rounded-md border border-border bg-background px-2 py-1 text-foreground"
            />
            <span className="text-xs text-muted-foreground">To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="text-xs rounded-md border border-border bg-background px-2 py-1 text-foreground"
            />
          </div>
        )}
      </div>

      {/* 3. Summary KPI Cards */}
      {isOverviewLoading ? (
        <div className="flex justify-center py-12 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-4">
          {/* Card 1: Unique Complaints Handled */}
          <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
            <span className="text-xs text-muted-foreground font-medium">Individual Complaints</span>
            <p className="text-2xl font-bold text-foreground mt-1 font-mono">{overview.uniqueIndividualComplaintsHandled ?? overview.totalHandled ?? 0}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{overview.uniqueRoomIssuesHandled || 0} room-level issues</p>
          </div>

          {/* Card 2: Unique Room-Level Issues Handled */}
          <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
            <span className="text-xs text-muted-foreground font-medium">Room-Level Issues</span>
            <p className="text-2xl font-bold text-foreground mt-1 font-mono">{overview.uniqueRoomIssuesHandled ?? 0}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{overview.roomIssuesResolvedCount || 0} resolved</p>
          </div>

          {/* Card 3: First-Attempt Success */}
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3.5 shadow-xs">
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="size-3.5" />
              1st Try Success
            </span>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              {overview.firstAttemptSuccessCount || 0}
            </p>
            <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5 truncate">
              {overview.firstAttemptSuccessRate || 0}% decided rate
            </p>
          </div>

          {/* Card 4: Not Solved on First Try */}
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3.5 shadow-xs">
            <span className="text-xs text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
              <RotateCcw className="size-3.5" />
              Not Solved 1st Try
            </span>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
              {overview.notSolvedFirstTryCount || 0}
            </p>
            <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5 truncate">
              Repeat work needed
            </p>
          </div>

          {/* Card 5: Subsequent Attempts */}
          <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Layers className="size-3.5" />
              Subsequent Attempts
            </span>
            <p className="text-2xl font-bold text-foreground mt-1 font-mono">{overview.subsequentResolutionAttempts || 0}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Beyond initial try</p>
          </div>

          {/* Card 6: Reopened Issues */}
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-3.5 shadow-xs">
            <span className="text-xs text-rose-700 dark:text-rose-400 font-semibold flex items-center gap-1">
              <AlertCircle className="size-3.5" />
              Reopened Issues
            </span>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1 font-mono">
              {overview.reopenedIssuesCount ?? overview.reopenedComplaintsCount ?? 0}
            </p>
            <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5 truncate">
              {overview.reopenedComplaintsCount || 0} complaint reopens
            </p>
          </div>

          {/* Card 7: Awaiting Confirmation */}
          <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <Clock className="size-3.5" />
              Awaiting Confirm
            </span>
            <p className="text-2xl font-bold text-foreground mt-1 font-mono">{overview.awaitingConfirmationCount || 0}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Pending student reply</p>
          </div>

          {/* Card 8: Unknown / Legacy */}
          <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs">
            <span className="text-xs text-muted-foreground font-medium">Historical / Unknown</span>
            <p className="text-2xl font-bold text-foreground mt-1 font-mono">{overview.unknownLegacyCount || 0}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Pre-status logging</p>
          </div>
        </div>
      )}

      {/* 4. Staff Performance Table */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="bg-muted/40 px-5 py-3.5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <UserCheck className="size-4 text-primary" />
              Staff Resolution Effectiveness
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click any staff row to inspect their detailed complaint resolution history.
            </p>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {filteredStaff.length} staff member{filteredStaff.length === 1 ? "" : "s"}
          </span>
        </div>

        {isTableLoading ? (
          <div className="flex justify-center py-16 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="bg-muted/30 border-b border-border text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Staff Member</th>
                  <th className="px-4 py-3 text-right">Assigned</th>
                  <th className="px-4 py-3 text-right">Resolved</th>
                  <th className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400">1st-Attempt Success</th>
                  <th className="px-4 py-3 text-right text-amber-600 dark:text-amber-400">Not Solved 1st Try</th>
                  <th className="px-4 py-3 text-right text-rose-600 dark:text-rose-400">Reopened</th>
                  <th className="px-4 py-3 text-right">Pending</th>
                  <th className="px-4 py-3 text-right">Avg Duration</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredStaff.map((staff) => (
                  <tr
                    key={staff.staffId}
                    onClick={() => setSelectedStaff(staff)}
                    className="hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                          {staff.name?.charAt(0) || "S"}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-xs">{staff.name}</p>
                          <p className="text-[10px] text-muted-foreground font-normal">{staff.staffRole}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">{staff.assignedCount}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground">{staff.resolvedCount}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {staff.firstAttemptSuccessCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                      {staff.notSolvedFirstTryCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                      {staff.reopenedCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">{staff.pendingCount}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                      {staff.avgResolutionDurationHours > 0 ? `${staff.avgResolutionDurationHours}h` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-primary hover:text-primary cursor-pointer px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStaff(staff);
                        }}
                      >
                        Inspect →
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Staff Drill-Down Modal Drawer */}
      <Dialog open={Boolean(selectedStaff)} onOpenChange={(open) => !open && setSelectedStaff(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="border-b border-border pb-3">
            <DialogTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <User className="size-4 text-primary" />
                <span>{selectedStaff?.name} — Resolution History</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {selectedStaff?.staffRole}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Complete historical record of assigned complaints, resolution attempts, and student feedback.
            </DialogDescription>
          </DialogHeader>

          {isDrilldownLoading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
              {/* Staff metrics summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs border border-border/80 rounded-lg p-3 bg-muted/20">
                <div>
                  <span className="text-[10px] text-muted-foreground">Total Handled</span>
                  <p className="font-bold text-foreground text-base mt-0.5">{drilldownData?.count || 0}</p>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">1st Try Success</span>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400 text-base mt-0.5">
                    {drilldownData?.complaints?.filter((c) => c.firstAttemptOutcome === "FIRST_ATTEMPT_SUCCESS").length || 0}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">Not Solved 1st Try</span>
                  <p className="font-bold text-amber-600 dark:text-amber-400 text-base mt-0.5">
                    {drilldownData?.complaints?.filter((c) => c.firstAttemptOutcome === "NOT_SOLVED_FIRST_TRY").length || 0}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold">Reopened</span>
                  <p className="font-bold text-rose-600 dark:text-rose-400 text-base mt-0.5">
                    {drilldownData?.complaints?.filter((c) => c.isReopened).length || 0}
                  </p>
                </div>
              </div>

              {/* Complaints list */}
              <div className="space-y-2.5">
                {(drilldownData?.complaints || []).map((c) => (
                  <div
                    key={c.complaintId}
                    className="rounded-lg border border-border bg-card p-3.5 space-y-2 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-xs text-foreground">{c.title}</h4>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                            Room {c.doorNumber}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {c.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{c.description}</p>
                      </div>

                      <div className="shrink-0 text-right">
                        {c.firstAttemptOutcome === "FIRST_ATTEMPT_SUCCESS" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 text-[10px]">
                            1st Try Success
                          </Badge>
                        ) : c.firstAttemptOutcome === "NOT_SOLVED_FIRST_TRY" ? (
                          <Badge className="bg-amber-500/15 text-amber-600 border border-amber-500/30 text-[10px]">
                            Not Solved 1st Try
                          </Badge>
                        ) : c.firstAttemptOutcome === "AWAITING_CONFIRMATION" ? (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Awaiting Feedback
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Timeline summary row */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/60">
                      <span>
                        Created: {new Date(c.createdAt).toLocaleDateString()} · Attempts: {c.totalAttempts}
                        {c.durationMs ? ` · Duration: ${Math.round(c.durationMs / (1000 * 60 * 60))}h` : ""}
                      </span>

                      <button
                        type="button"
                        onClick={() => setSelectedComplaintId(c.complaintId)}
                        className="text-primary hover:underline text-xs flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <History className="size-3" />
                        <span>View Timeline</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 6. Chronological Resolution Timeline Modal */}
      <Dialog open={Boolean(selectedComplaintId)} onOpenChange={(open) => !open && setSelectedComplaintId(null)}>
        <DialogContent className="max-w-full sm:max-w-xl p-4 sm:p-6">
          <DialogHeader className="border-b border-border pb-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-primary" />
              <span>Complaint Resolution Lifecycle</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Chronological status history events and resolution attempts.
            </DialogDescription>
          </DialogHeader>

          {isTimelineLoading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted/20 border border-border p-3 space-y-1">
                <p className="font-bold text-sm text-foreground">{timelineData?.complaint?.title}</p>
                <p className="text-xs text-muted-foreground">
                  Room {timelineData?.complaint?.doorNumber} · Category: {timelineData?.complaint?.category}
                </p>
              </div>

              {/* Status events stream */}
              <div className="space-y-3 pl-2 border-l-2 border-border ml-2">
                {(timelineData?.complaint?.statusHistory || []).map((ev, i) => (
                  <div key={i} className="relative pl-4 space-y-0.5">
                    <div className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-primary border-2 border-background" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{ev.status}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(ev.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {ev.note && <p className="text-[11px] text-muted-foreground">{ev.note}</p>}
                    {ev.actor && <p className="text-[10px] text-muted-foreground/80 italic">Actor: {ev.actor}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

