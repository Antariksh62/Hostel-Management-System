import React, { useState, useEffect, useContext } from "react";
import {
  ShieldAlert, Users, Layers, AlertTriangle, Activity, RefreshCw,
  Plus, ArrowRight, UserCheck, UserX, Clock, Phone, Building2,
  FileText, Search, Filter, CheckCircle2, ChevronRight, Lock, Eye,
  Edit, KeyRound, ShieldCheck
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader, EmptyState } from "@/components/hms/app-shell";
import { StatCard } from "@/components/hms/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AuthContext } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import api from "@/services/api";
import { toast } from "sonner";

export default function MainAdminDashboard() {
  const { user, logout } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [activeTab, setActiveTab] = useState("overview");

  // Filter states
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [showCreateDept, setShowCreateDept] = useState(false);
  const [showEditDept, setShowEditDept] = useState(false);
  const [showCreateStaff, setShowCreateStaff] = useState(false);
  const [showEditStaff, setShowEditStaff] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [showCreateInstance, setShowCreateInstance] = useState(false);
  const [showTransferWork, setShowTransferWork] = useState(false);
  const [showPermConfirm, setShowPermConfirm] = useState(false);
  const [selectedStaffForPerm, setSelectedStaffForPerm] = useState(null);
  const [pendingPerms, setPendingPerms] = useState([]);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [selectedComplaintTitle, setSelectedComplaintTitle] = useState("");

  // Form states
  const [deptForm, setDeptForm] = useState({ name: "", code: "", description: "", template: "GENERAL_STAFF", complaintCategories: "" });
  const [editDeptForm, setEditDeptForm] = useState({ id: "", name: "", description: "", supervisor: "", complaintCategories: "", isActive: true });
  const [staffForm, setStaffForm] = useState({
    name: "",
    email: "",
    password: "",
    employeeId: "",
    phoneNumber: "",
    designation: "Technician",
    staffRole: "Technician",
    departmentId: "",
    isSupervisor: false,
    dashboardPermissions: []
  });
  const [editStaffForm, setEditStaffForm] = useState({
    id: "",
    name: "",
    email: "",
    employeeId: "",
    phoneNumber: "",
    departmentId: "",
    designation: "",
    staffRole: "Technician",
    isSupervisor: false,
    isActive: true
  });
  const [resetPasswordForm, setResetPasswordForm] = useState({ id: "", name: "", newPassword: "" });
  const [categoryForm, setCategoryForm] = useState({ name: "", departmentId: "", description: "", defaultPriority: "Medium", isConfidential: false });
  const [instanceForm, setInstanceForm] = useState({ name: "", departmentId: "", templateId: "GENERAL_STAFF", activeModules: ["assigned_work", "work_history"] });
  const [transferForm, setTransferForm] = useState({ fromStaffId: "", toStaffId: "", reason: "" });

  // 1. Data Queries
  const { data: deptData, isLoading: deptsLoading } = useQuery({
    queryKey: ["admin-departments"],
    queryFn: () => api.get("/admin/departments").then((r) => r.data?.departments || []),
  });

  const { data: categoryData = [] } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => api.get("/admin/categories").then((r) => r.data?.categories || []),
  });

  const { data: instanceData = [] } = useQuery({
    queryKey: ["admin-instances"],
    queryFn: () => api.get("/admin/instances").then((r) => r.data?.instances || []),
  });

  const { data: staffList = [], isLoading: staffLoading } = useQuery({
    queryKey: ["admin-staff"],
    queryFn: () => api.get("/admin/staff").then((r) => r.data?.staff || []),
  });

  const { data: monitoringData, isLoading: feedLoading } = useQuery({
    queryKey: ["admin-feed", deptFilter, statusFilter, searchQuery],
    queryFn: () => {
      let url = `/admin/monitoring/feed?page=1&limit=50`;
      if (deptFilter !== "all") url += `&department=${deptFilter}`;
      if (statusFilter !== "all") url += `&status=${statusFilter}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      return api.get(url).then((r) => r.data);
    },
  });

  const { data: auditLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: () => api.get("/admin/audit-logs?limit=50").then((r) => r.data?.logs || []),
  });

  const { data: securityIncidents = [] } = useQuery({
    queryKey: ["admin-security"],
    queryFn: () => api.get("/security/incidents?limit=20").then((r) => r.data?.incidents || []).catch(() => []),
  });

  const { data: antiRaggingCases = [] } = useQuery({
    queryKey: ["admin-anti-ragging"],
    queryFn: () => api.get("/anti-ragging/cases?limit=20").then((r) => r.data?.cases || []).catch(() => []),
  });

  const { data: overviewStats, isLoading: overviewLoading } = useQuery({
    queryKey: ["admin-overview-stats"],
    queryFn: () => api.get("/admin/overview/stats").then((r) => r.data || null).catch(() => null),
  });

  // Socket updates
  useEffect(() => {
    if (!socket) return;
    const refreshAll = () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feed"] });
      queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    };

    socket.on("complaint:created", refreshAll);
    socket.on("complaint:status-updated", refreshAll);
    socket.on("complaint:assigned", refreshAll);

    return () => {
      socket.off("complaint:created", refreshAll);
      socket.off("complaint:status-updated", refreshAll);
      socket.off("complaint:assigned", refreshAll);
    };
  }, [socket, queryClient]);

  // Mutations
  const createDeptMutation = useMutation({
    mutationFn: (data) => api.post("/admin/departments", data),
    onSuccess: () => {
      toast.success("Department created successfully");
      setShowCreateDept(false);
      setDeptForm({ name: "", code: "", description: "", template: "GENERAL_STAFF", complaintCategories: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview-stats"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });

  const updateDeptMutation = useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/admin/departments/${id}`, data),
    onSuccess: () => {
      toast.success("Department updated successfully");
      setShowEditDept(false);
      queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview-stats"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });

  const createStaffMutation = useMutation({
    mutationFn: (data) => api.post("/admin/staff", data),
    onSuccess: () => {
      toast.success("Staff account created successfully");
      setShowCreateStaff(false);
      setStaffForm({
        name: "",
        email: "",
        password: "",
        employeeId: "",
        phoneNumber: "",
        designation: "Technician",
        staffRole: "Technician",
        departmentId: "",
        isSupervisor: false,
        dashboardPermissions: []
      });
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview-stats"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });

  const updateStaffMutation = useMutation({
    mutationFn: ({ id, ...data }) => api.patch(`/admin/staff/${id}`, data),
    onSuccess: () => {
      toast.success("Staff account updated successfully");
      setShowEditStaff(false);
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview-stats"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, newPassword }) => api.post(`/admin/staff/${id}/reset-password`, { newPassword }),
    onSuccess: () => {
      toast.success("Password reset successfully");
      setShowResetPassword(false);
      setResetPasswordForm({ id: "", name: "", newPassword: "" });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });

  const toggleAvailabilityMutation = useMutation({
    mutationFn: ({ id, isAvailable, reason }) => api.patch(`/admin/staff/${id}/availability`, { isAvailable, availabilityReason: reason }),
    onSuccess: () => {
      toast.success("Staff availability updated");
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active, reason }) =>
      active ? api.post(`/admin/staff/${id}/restore`) : api.post(`/admin/staff/${id}/deactivate`, { reason: reason || "Administrative action" }),
    onSuccess: () => {
      toast.success("Staff status updated");
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });

  const transferWorkMutation = useMutation({
    mutationFn: (data) => api.post("/admin/staff/transfer-work", data),
    onSuccess: (res) => {
      toast.success(`Successfully transferred ${res.data?.transferredCount || 0} open jobs.`);
      setShowTransferWork(false);
      setTransferForm({ fromStaffId: "", toStaffId: "", reason: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
      queryClient.invalidateQueries({ queryKey: ["admin-feed"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });

  const triggerEscalationMutation = useMutation({
    mutationFn: () => api.post("/admin/escalations/trigger"),
    onSuccess: (res) => {
      toast.info(`Escalation check completed: ${res.data?.escalatedCount || 0} complaints alerted.`);
      queryClient.invalidateQueries({ queryKey: ["admin-feed"] });
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data) => api.post("/admin/categories", data),
    onSuccess: () => {
      toast.success("Category created successfully");
      setShowCreateCategory(false);
      setCategoryForm({ name: "", departmentId: "", description: "", defaultPriority: "Medium", isConfidential: false });
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });

  const createInstanceMutation = useMutation({
    mutationFn: (data) => api.post("/admin/instances", data),
    onSuccess: () => {
      toast.success("Dashboard instance created successfully");
      setShowCreateInstance(false);
      setInstanceForm({ name: "", departmentId: "", templateId: "GENERAL_STAFF", activeModules: ["assigned_work", "work_history"] });
      queryClient.invalidateQueries({ queryKey: ["admin-instances"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });

  const updateExportMutation = useMutation({
    mutationFn: ({ id, exportPermissions }) => api.patch(`/admin/staff/${id}/export-permissions`, { exportPermissions }),
    onSuccess: () => {
      toast.success("Export permissions updated");
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: ({ id, dashboardPermissions, confirmedMultipleAccess }) =>
      api.post(`/admin/staff/${id}/permissions`, { dashboardPermissions, confirmedMultipleAccess }),
    onSuccess: () => {
      toast.success("Permissions updated successfully");
      setShowPermConfirm(false);
      setSelectedStaffForPerm(null);
      setPendingPerms([]);
      queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message)
  });

  const handleOpenTimeline = async (complaintId, title) => {
    try {
      setSelectedComplaintTitle(title);
      const res = await api.get(`/staff/complaint/${complaintId}/events`);
      setTimelineEvents(res.data?.events || []);
      setShowTimelineModal(true);
    } catch (err) {
      toast.error("Failed to load event history: " + (err.response?.data?.message || err.message));
    }
  };

  // Metrics
  const departments = deptData || [];
  const complaints = monitoringData?.complaints || [];
  const totalComplaints = monitoringData?.total || 0;
  const pendingCount = complaints.filter(c => c.status === "Pending").length;
  const inProgressCount = complaints.filter(c => c.status === "In Progress").length;
  const resolvedCount = complaints.filter(c => c.status === "Resolved").length;
  const escalatedCount = complaints.filter(c => (c.escalationLevel || 0) > 0).length;

  return (
    <AppShell
      product="Hostel Management System"
      roleLabel="Main System Administrator"
      userName={user?.name || "Main Admin"}
      userSubtitle="Central Operational Control"
      nav={[
        { to: "/main-admin-dashboard", label: "Control Center", icon: Building2 },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerEscalationMutation.mutate()}
            disabled={triggerEscalationMutation.isPending}
            className="cursor-pointer"
          >
            <Clock className="w-4 h-4 mr-1.5" />
            Check SLA Escalations
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
          >
            Sign Out
          </Button>
        </div>
      }
    >
      <div className="max-w-7xl mx-auto space-y-6">
        <PageHeader
          title="Central Operational Control Center"
          description="Supreme administrative management across all hostel departments, employee allocation, escalation policies, and operational audit."
        />

        {/* Global Metric Strips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard title="Total Complaints" value={totalComplaints} />
          <StatCard title="Active Departments" value={departments.length} />
          <StatCard title="Active Staff" value={staffList.filter(s => s.isActive).length} />
          <StatCard title="Pending Assignment" value={pendingCount} />
          <StatCard title="In Progress" value={inProgressCount} />
          <StatCard
            title="SLA Escalated"
            value={escalatedCount}
            variant={escalatedCount > 0 ? "critical" : "default"}
          />
        </div>

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="rounded-lg text-xs font-semibold cursor-pointer">Overview</TabsTrigger>
            <TabsTrigger value="monitoring" className="rounded-lg text-xs font-semibold cursor-pointer">Live Complaint Feed ({totalComplaints})</TabsTrigger>
            <TabsTrigger value="departments" className="rounded-lg text-xs font-semibold cursor-pointer">Departments ({departments.length})</TabsTrigger>
            <TabsTrigger value="staff" className="rounded-lg text-xs font-semibold cursor-pointer">Staff & Permissions ({staffList.length})</TabsTrigger>
            <TabsTrigger value="security" className="rounded-lg text-xs font-semibold cursor-pointer">Security ({securityIncidents.length})</TabsTrigger>
            <TabsTrigger value="antiragging" className="rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-red-500" />
              Anti-Ragging ({antiRaggingCases.length})
            </TabsTrigger>
            <TabsTrigger value="audit" className="rounded-lg text-xs font-semibold cursor-pointer">Audit Logs</TabsTrigger>
          </TabsList>

          {/* TAB 1: OVERVIEW */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Department Overview Cards */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    Operational Departments Status
                  </h3>
                  <Button size="sm" onClick={() => setShowCreateDept(true)} className="cursor-pointer">
                    <Plus className="w-4 h-4 mr-1.5" />
                    New Department
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {departments.map((d) => (
                    <div key={d._id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white">{d.name}</span>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">{d.code}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{d.description}</p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-400">
                          <strong>{d.employeeCount || 0}</strong> staff active
                        </span>
                        <span className={d.openJobsCount > 0 ? "text-amber-600 font-semibold" : "text-emerald-600 font-semibold"}>
                          <strong>{d.openJobsCount || 0}</strong> open jobs
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions & Recent Security / Anti-Ragging */}
              <div className="space-y-4">
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                  Protected Modules Summary
                </h3>

                <div className="p-4 rounded-xl border border-red-200 dark:border-red-950/40 bg-red-50/50 dark:bg-red-950/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-900 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      Anti-Ragging Confidential Cell
                    </span>
                    <Badge variant="destructive" className="text-xs">{antiRaggingCases.length} Cases</Badge>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Confidential case records with direct investigation logs, hearing hearings, and administrative sanctions.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("antiragging")} className="w-full text-xs font-medium cursor-pointer">
                    Open Anti-Ragging Vault
                  </Button>
                </div>

                <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-950/40 bg-blue-50/50 dark:bg-blue-950/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 dark:text-blue-400 uppercase tracking-wider">
                      Campus Security Watch
                    </span>
                    <Badge variant="outline" className="text-xs font-semibold">{securityIncidents.length} Alerts</Badge>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Real-time safety patrols, checkpoint unauthorized access, and perimeter incident logging.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setActiveTab("security")} className="w-full text-xs font-medium cursor-pointer">
                    View Security Desk
                  </Button>
                </div>
              </div>
            </div>

            {/* Department Breakdown Overview Table */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    Department Workload & SLA Breakdown
                  </h4>
                  <p className="text-xs text-slate-500">Live tally of active, in-progress, resolved, and overdue complaints by operational department.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-overview-stats"] })} className="cursor-pointer h-8 text-xs">
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Refresh
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Department</th>
                      <th className="p-3">Code</th>
                      <th className="p-3 text-center">Pending</th>
                      <th className="p-3 text-center">In Progress</th>
                      <th className="p-3 text-center">Resolved</th>
                      <th className="p-3 text-center">Overdue</th>
                      <th className="p-3 text-right">Total Assigned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(overviewStats?.departmentBreakdown || []).length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400">
                          No department metrics recorded.
                        </td>
                      </tr>
                    ) : (
                      overviewStats.departmentBreakdown.map((row) => (
                        <tr key={row.departmentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-3 font-semibold text-slate-900 dark:text-white">{row.name}</td>
                          <td className="p-3 font-mono text-[11px] text-slate-500">{row.code}</td>
                          <td className="p-3 text-center">
                            <span className={row.pending > 0 ? "font-bold text-amber-600" : "text-slate-400"}>
                              {row.pending}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={row.inProgress > 0 ? "font-bold text-blue-600" : "text-slate-400"}>
                              {row.inProgress}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="font-semibold text-emerald-600">{row.resolved}</span>
                          </td>
                          <td className="p-3 text-center">
                            {row.overdue > 0 ? (
                              <Badge variant="destructive" className="text-[10px] font-bold">
                                {row.overdue}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="p-3 text-right font-bold text-slate-900 dark:text-white">
                            {row.total}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Staff Workloads Overview Table */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    Staff Capacity & Workload Balance
                  </h4>
                  <p className="text-xs text-slate-500">Active assigned jobs and historical completions per staff member.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Staff Member</th>
                      <th className="p-3">Department</th>
                      <th className="p-3">Designation</th>
                      <th className="p-3 text-center">Active Workload</th>
                      <th className="p-3 text-center">Completed Work</th>
                      <th className="p-3 text-right">Account Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(overviewStats?.staffWorkloads || []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">
                          No staff data available.
                        </td>
                      </tr>
                    ) : (
                      overviewStats.staffWorkloads.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-3 font-medium text-slate-900 dark:text-white">
                            <div className="flex items-center gap-1.5">
                              <span>{s.name}</span>
                              {s.isSupervisor && (
                                <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700 border-purple-200">
                                  Supervisor
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">{s.email}</div>
                          </td>
                          <td className="p-3">{s.department || "General"}</td>
                          <td className="p-3 text-slate-600 dark:text-slate-400">{s.designation || "Staff"}</td>
                          <td className="p-3 text-center">
                            <Badge variant={s.activeJobs > 3 ? "critical" : s.activeJobs > 0 ? "warning" : "secondary"}>
                              {s.activeJobs} jobs
                            </Badge>
                          </td>
                          <td className="p-3 text-center font-semibold text-emerald-600">
                            {s.resolvedJobs} completed
                          </td>
                          <td className="p-3 text-right">
                            <Badge variant={s.isActive ? "success" : "secondary"}>
                              {s.isActive ? "Active" : "Deactivated"}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: LIVE GLOBAL COMPLAINT FEED */}
          <TabsContent value="monitoring" className="space-y-4 mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <Input
                    placeholder="Search complaint or room..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-transparent"
                >
                  <option value="all">All Departments</option>
                  {departments.map(d => (
                    <option key={d._id} value={d.code}>{d.name}</option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-transparent"
                >
                  <option value="all">All Statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Reopened">Reopened</option>
                </select>
              </div>
              <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-feed"] })} className="cursor-pointer">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Refresh Feed
              </Button>
            </div>

            {/* Complaints Table */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Complaint</th>
                      <th className="p-3">Department</th>
                      <th className="p-3">Room</th>
                      <th className="p-3">Resident</th>
                      <th className="p-3">Assigned Staff</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">SLA / Escalation</th>
                      <th className="p-3 text-right">Timeline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {complaints.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-400">
                          No complaints match the current filter.
                        </td>
                      </tr>
                    ) : (
                      complaints.map((c) => (
                        <tr key={c._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-3 font-medium text-slate-900 dark:text-white max-w-xs truncate">
                            {c.title}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {c.departmentId?.name || c.category || "General"}
                            </Badge>
                          </td>
                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                            {c.doorNumber || "General"}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400">
                            {c.studentId?.name || "Student"}
                          </td>
                          <td className="p-3">
                            {c.assignedTo ? (
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                {c.assignedTo.name}
                              </span>
                            ) : (
                              <span className="text-amber-600 font-semibold italic">Unassigned Exception</span>
                            )}
                          </td>
                          <td className="p-3">
                            <Badge variant={c.status === "Resolved" ? "success" : c.status === "In Progress" ? "warning" : "default"}>
                              {c.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {(c.escalationLevel || 0) > 0 ? (
                              <Badge variant="destructive" className="font-semibold text-[10px]">
                                Level {c.escalationLevel} Escalated
                              </Badge>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Normal SLA</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenTimeline(c._id, c.title)}
                              className="text-xs text-blue-600 hover:text-blue-700 cursor-pointer h-7 px-2"
                            >
                              <Clock className="w-3.5 h-3.5 mr-1" />
                              Events
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: DEPARTMENTS */}
          <TabsContent value="departments" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Department Catalog & Configuration</h3>
                <p className="text-xs text-slate-500">Configure workload balancing strategies and automated escalation thresholds per department.</p>
              </div>
              <Button size="sm" onClick={() => setShowCreateDept(true)} className="cursor-pointer">
                <Plus className="w-4 h-4 mr-1.5" />
                Add Department
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map((dept) => (
                <div key={dept._id} className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-slate-900 dark:text-white">{dept.name}</span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">{dept.code}</Badge>
                        <Badge variant={dept.isActive ? "default" : "secondary"}>
                          {dept.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2">{dept.description || "Operational hostel department."}</p>

                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg text-xs space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Supervisor:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {dept.supervisor?.name || "None Assigned"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500 font-medium">Active Staff:</span>
                        <span className="font-semibold">{dept.staffMembers?.length || dept.employeeCount || 0} members</span>
                      </div>
                      <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-[11px] text-slate-500 block mb-1">Handled Categories:</span>
                        <div className="flex flex-wrap gap-1">
                          {(dept.complaintCategories || []).length === 0 ? (
                            <span className="text-[10px] text-slate-400 italic">None configured</span>
                          ) : (
                            dept.complaintCategories.map((c) => (
                              <span key={c} className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 text-[10px] font-medium">
                                {c}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditDeptForm({
                          id: dept._id,
                          name: dept.name,
                          description: dept.description || "",
                          supervisor: dept.supervisor?._id || dept.supervisor || "",
                          complaintCategories: (dept.complaintCategories || []).join(", "),
                          isActive: dept.isActive !== false
                        });
                        setShowEditDept(true);
                      }}
                      className="h-8 text-xs cursor-pointer flex-1"
                    >
                      <Edit className="w-3.5 h-3.5 mr-1" />
                      Configure
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateDeptMutation.mutate({ id: dept._id, isActive: !dept.isActive })}
                      className={`h-8 text-xs cursor-pointer ${dept.isActive ? "text-amber-600 hover:text-amber-700" : "text-emerald-600"}`}
                    >
                      {dept.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Complaint Categories Catalog */}
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Complaint Categories & Routing Rules</h4>
                  <p className="text-xs text-slate-500">Student selection categories mapped to operational departments with priority and SLA rules.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowCreateCategory(true)} className="cursor-pointer">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Category
                </Button>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Category Name</th>
                      <th className="p-3">Code</th>
                      <th className="p-3">Target Department</th>
                      <th className="p-3">Default Priority</th>
                      <th className="p-3">Confidentiality</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {categoryData.map((cat) => (
                      <tr key={cat._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">{cat.name}</td>
                        <td className="p-3 font-mono text-[11px] text-slate-400">{cat.code}</td>
                        <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                          {cat.departmentId?.name || "General"}
                        </td>
                        <td className="p-3">
                          <Badge variant={cat.defaultPriority === "Emergency" || cat.defaultPriority === "High" ? "critical" : "secondary"}>
                            {cat.defaultPriority}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {cat.isConfidential ? (
                            <Badge variant="outline" className="border-red-500 text-red-600 bg-red-50 dark:bg-red-950/20 font-bold">
                              Confidential
                            </Badge>
                          ) : (
                            <span className="text-slate-400">Standard</span>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant={cat.isActive !== false ? "success" : "secondary"}>
                            {cat.isActive !== false ? "Active" : "Disabled"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Independent Dashboard Instances */}
            <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Dashboard Templates & Operational Instances</h4>
                  <p className="text-xs text-slate-500">Configured workspace instances for specialized staff roles without hardcoded employee limits.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowCreateInstance(true)} className="cursor-pointer">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create Instance
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {instanceData.map((inst) => (
                  <div key={inst._id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{inst.name}</span>
                      <Badge variant="outline" className="text-[10px]">{inst.templateId}</Badge>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">ID: {inst.instanceId}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      Department: <strong className="text-slate-800 dark:text-slate-200">{inst.departmentId?.name || "General"}</strong>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {(inst.activeModules || []).map((m) => (
                        <span key={m} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* TAB 4: STAFF & PERMISSIONS */}
          <TabsContent value="staff" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Staff Management & Operational Workload</h3>
                <p className="text-xs text-slate-500">Create operational accounts, adjust management-controlled availability, transfer unfinished work, and grant dashboard permissions.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowTransferWork(true)} className="cursor-pointer">
                  Transfer Open Work
                </Button>
                <Button size="sm" onClick={() => setShowCreateStaff(true)} className="cursor-pointer">
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Staff Account
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Staff Member</th>
                      <th className="p-3">Employee ID & Phone</th>
                      <th className="p-3">Department & Designation</th>
                      <th className="p-3">Role & Supervisor</th>
                      <th className="p-3">Workload</th>
                      <th className="p-3">Account Status</th>
                      <th className="p-3">Joined Date</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {staffList.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3 font-medium text-slate-900 dark:text-white">
                          <div className="font-semibold">{s.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{s.email}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-[11px]">{s.employeeId || "—"}</div>
                          <div className="text-[11px] text-slate-500">{s.phoneNumber || "—"}</div>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{s.department || "General"}</div>
                          <div className="text-[11px] text-slate-500">{s.designation || "Staff"}</div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span>{s.staffRole || "Technician"}</span>
                            {s.isSupervisor && (
                              <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-700 border-purple-200">
                                Supervisor
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {s.activeWorkload || 0} active
                          </span>
                          <span className="text-[11px] text-slate-400 ml-1.5">(Score: {s.workloadScore || 0})</span>
                        </td>
                        <td className="p-3">
                          <Badge variant={s.isActive ? "success" : "secondary"}>
                            {s.isActive ? "Active" : "Deactivated"}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-500 font-mono text-[11px]">
                          {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="p-3 text-right space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditStaffForm({
                                id: s.id,
                                name: s.name,
                                email: s.email,
                                employeeId: s.employeeId || "",
                                phoneNumber: s.phoneNumber || "",
                                departmentId: s.departmentId || "",
                                designation: s.designation || "",
                                staffRole: s.staffRole || "Technician",
                                isSupervisor: Boolean(s.isSupervisor),
                                isActive: s.isActive !== false
                              });
                              setShowEditStaff(true);
                            }}
                            className="h-7 text-xs px-2 cursor-pointer"
                          >
                            <Edit className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setResetPasswordForm({ id: s.id, name: s.name, newPassword: "" });
                              setShowResetPassword(true);
                            }}
                            className="h-7 text-xs px-2 cursor-pointer text-amber-600 hover:text-amber-700"
                          >
                            <KeyRound className="w-3 h-3 mr-1" />
                            Reset PW
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedStaffForPerm(s);
                              setPendingPerms(s.dashboardPermissions || []);
                              setShowPermConfirm(true);
                            }}
                            className="h-7 text-xs px-2 cursor-pointer"
                          >
                            Perms
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleActiveMutation.mutate({ id: s.id, active: !s.isActive })}
                            className={`h-7 text-xs px-2 cursor-pointer ${s.isActive ? "text-red-600 hover:text-red-700" : "text-emerald-600"}`}
                          >
                            {s.isActive ? "Deactivate" : "Restore"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 5: SECURITY */}
          <TabsContent value="security" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Campus Security Incident Desk</h3>
                <p className="text-xs text-slate-500">Security checkpoint incidents, perimeter safety alerts, and night inspection records.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {securityIncidents.length === 0 ? (
                <div className="col-span-2 p-8 text-center text-slate-400 border border-dashed rounded-xl">
                  No active security incidents reported.
                </div>
              ) : (
                securityIncidents.map((sec) => (
                  <div key={sec._id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">{sec.title}</span>
                      <Badge variant={sec.severity === "CRITICAL" ? "destructive" : "warning"}>{sec.severity}</Badge>
                    </div>
                    <p className="text-xs text-slate-500">{sec.description}</p>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      📍 Location: {sec.location}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Reported: {new Date(sec.createdAt).toLocaleString()} · Status: <strong>{sec.status}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* TAB 6: ANTI-RAGGING */}
          <TabsContent value="antiragging" className="space-y-4 mt-4">
            <div className="p-4 rounded-xl border border-red-200 dark:border-red-950/60 bg-red-50 dark:bg-red-950/20 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-sm font-bold text-red-900 dark:text-red-300 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-red-600" />
                  Anti-Ragging Strict Confidentiality Vault
                </span>
                <p className="text-xs text-red-700 dark:text-red-400">
                  Protected under Central Statutory Regulations. Only Main Admin, Incharge, and designated Anti-Ragging committee members can view these records.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {antiRaggingCases.length === 0 ? (
                <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl">
                  No anti-ragging cases registered in the confidential database.
                </div>
              ) : (
                antiRaggingCases.map((arc) => (
                  <div key={arc._id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="font-mono text-red-600">{arc.caseNumber}</span>
                        <span>{arc.title}</span>
                      </div>
                      <Badge variant="destructive">{arc.severity}</Badge>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{arc.description}</p>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>Status: <strong>{arc.status}</strong></span>
                      <span>Location: <strong>{arc.location}</strong></span>
                      <span>Notes Count: <strong>{arc.investigationNotes?.length || 0}</strong></span>
                      <span>Actions Taken: <strong>{arc.actionsTaken?.length || 0}</strong></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* TAB 7: AUDIT LOGS */}
          <TabsContent value="audit" className="space-y-4 mt-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-bold text-sm">
                System-Wide Administrative Audit Trail
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Performed By</th>
                      <th className="p-3">Target</th>
                      <th className="p-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {auditLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="p-3 text-slate-500 font-mono text-[11px]">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                          {log.action}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          {log.performedBy?.name} ({log.performedBy?.role})
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400">
                          {log.target?.identifier || log.target?.model || "—"}
                        </td>
                        <td className="p-3 text-slate-500 font-mono text-[10px] max-w-xs truncate">
                          {JSON.stringify(log.details)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* TIMELINE EVENT MODAL */}
        <Dialog open={showTimelineModal} onOpenChange={setShowTimelineModal}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Authoritative Event History: {selectedComplaintTitle}
              </DialogTitle>
              <DialogDescription>
                Server-generated append-only event trail recording every lifecycle stage change and intervention.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 my-2">
              {timelineEvents.length === 0 ? (
                <div className="text-center p-6 text-slate-400">No events recorded.</div>
              ) : (
                <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-4 space-y-4 pl-4">
                  {timelineEvents.map((evt, idx) => (
                    <div key={idx} className="relative">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white dark:ring-slate-900" />
                      <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                        <span>{evt.eventType}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(evt.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{evt.note}</p>
                      <span className="text-[10px] text-slate-400">
                        Actor: {evt.actor?.name} ({evt.actor?.role})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setShowTimelineModal(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* CREATE DEPARTMENT MODAL */}
        <Dialog open={showCreateDept} onOpenChange={setShowCreateDept}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Department</DialogTitle>
              <DialogDescription>Set department code, name, and operational dashboard template.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-semibold">Department Name</label>
                <Input
                  placeholder="e.g. Elevators / Lifts"
                  value={deptForm.name}
                  onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Uppercase Code</label>
                <Input
                  placeholder="e.g. ELEVATORS"
                  value={deptForm.code}
                  onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Description</label>
                <Input
                  placeholder="Maintenance responsibility description"
                  value={deptForm.description}
                  onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Dashboard Template</label>
                <select
                  value={deptForm.template}
                  onChange={(e) => setDeptForm({ ...deptForm, template: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-transparent"
                >
                  <option value="GENERAL_STAFF">General Staff</option>
                  <option value="PLUMBER">Plumber</option>
                  <option value="ELECTRICIAN">Electrician</option>
                  <option value="WORKSHOP">Workshop</option>
                  <option value="CLEANING">Cleaning</option>
                  <option value="SECURITY">Security</option>
                  <option value="ANTI_RAGGING">Anti-Ragging</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDept(false)}>Cancel</Button>
              <Button onClick={() => createDeptMutation.mutate(deptForm)} disabled={createDeptMutation.isPending}>
                Create Department
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* CREATE STAFF MODAL */}
        <Dialog open={showCreateStaff} onOpenChange={setShowCreateStaff}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add Staff Member</DialogTitle>
              <DialogDescription>Create a new employee login and assign department membership.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-semibold">Full Name *</label>
                <Input
                  placeholder="e.g. Ramesh Kumar"
                  value={staffForm.name}
                  onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold">Employee ID</label>
                  <Input
                    placeholder="EMP-1042"
                    value={staffForm.employeeId}
                    onChange={(e) => setStaffForm({ ...staffForm, employeeId: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Phone Number</label>
                  <Input
                    placeholder="+91 9876543210"
                    value={staffForm.phoneNumber}
                    onChange={(e) => setStaffForm({ ...staffForm, phoneNumber: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold">Login Email / ID *</label>
                <Input
                  placeholder="ramesh.plumber@hostel.pict.edu"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Password *</label>
                <Input
                  type="password"
                  placeholder="Secure password"
                  value={staffForm.password}
                  onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold">Designation</label>
                  <Input
                    placeholder="e.g. Senior Electrician"
                    value={staffForm.designation}
                    onChange={(e) => setStaffForm({ ...staffForm, designation: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Staff Role</label>
                  <select
                    value={staffForm.staffRole}
                    onChange={(e) => setStaffForm({ ...staffForm, staffRole: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-transparent"
                  >
                    <option value="Technician">Technician</option>
                    <option value="Attendant">Attendant</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="Security Officer">Security Officer</option>
                    <option value="Committee Member">Committee Member</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold">Primary Department *</label>
                <select
                  value={staffForm.departmentId}
                  onChange={(e) => setStaffForm({ ...staffForm, departmentId: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-transparent"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="supervisorCheck"
                  checked={staffForm.isSupervisor}
                  onChange={(e) => setStaffForm({ ...staffForm, isSupervisor: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <label htmlFor="supervisorCheck" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  Designate as Department Supervisor (Can assign complaints to colleagues)
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateStaff(false)}>Cancel</Button>
              <Button
                onClick={() => createStaffMutation.mutate(staffForm)}
                disabled={createStaffMutation.isPending || !staffForm.name || !staffForm.email || !staffForm.password || !staffForm.departmentId}
              >
                Create Staff Account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* EDIT DEPARTMENT MODAL */}
        <Dialog open={showEditDept} onOpenChange={setShowEditDept}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Configure Department</DialogTitle>
              <DialogDescription>Update department details, supervisor, handled categories, and status.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-semibold">Department Name</label>
                <Input
                  value={editDeptForm.name}
                  onChange={(e) => setEditDeptForm({ ...editDeptForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Description</label>
                <Input
                  value={editDeptForm.description}
                  onChange={(e) => setEditDeptForm({ ...editDeptForm, description: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Department Supervisor</label>
                <select
                  value={editDeptForm.supervisor}
                  onChange={(e) => setEditDeptForm({ ...editDeptForm, supervisor: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-transparent"
                >
                  <option value="">None Assigned</option>
                  {staffList.filter(s => s.isActive).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.department})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold">Handled Complaint Categories (comma separated)</label>
                <Input
                  placeholder="e.g. Water leakage, Tap broken, Clogged drain"
                  value={editDeptForm.complaintCategories}
                  onChange={(e) => setEditDeptForm({ ...editDeptForm, complaintCategories: e.target.value })}
                />
                <span className="text-[10px] text-slate-400">Separate multiple categories with commas.</span>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="activeDeptCheck"
                  checked={editDeptForm.isActive}
                  onChange={(e) => setEditDeptForm({ ...editDeptForm, isActive: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <label htmlFor="activeDeptCheck" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  Department Active (Inactive departments retain historical complaints safely)
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDept(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  const categoriesArray = editDeptForm.complaintCategories
                    ? editDeptForm.complaintCategories.split(",").map(s => s.trim()).filter(Boolean)
                    : [];
                  updateDeptMutation.mutate({
                    id: editDeptForm.id,
                    name: editDeptForm.name,
                    description: editDeptForm.description,
                    supervisor: editDeptForm.supervisor || null,
                    complaintCategories: categoriesArray,
                    isActive: editDeptForm.isActive
                  });
                }}
                disabled={updateDeptMutation.isPending}
              >
                Save Department
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* EDIT STAFF MODAL */}
        <Dialog open={showEditStaff} onOpenChange={setShowEditStaff}>
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Staff Account</DialogTitle>
              <DialogDescription>Modify employee profile, designation, department transfer, or supervisor status.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-semibold">Full Name</label>
                <Input
                  value={editStaffForm.name}
                  onChange={(e) => setEditStaffForm({ ...editStaffForm, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold">Employee ID</label>
                  <Input
                    value={editStaffForm.employeeId}
                    onChange={(e) => setEditStaffForm({ ...editStaffForm, employeeId: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Phone Number</label>
                  <Input
                    value={editStaffForm.phoneNumber}
                    onChange={(e) => setEditStaffForm({ ...editStaffForm, phoneNumber: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold">Email / Login ID</label>
                <Input
                  value={editStaffForm.email}
                  onChange={(e) => setEditStaffForm({ ...editStaffForm, email: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold">Designation</label>
                  <Input
                    value={editStaffForm.designation}
                    onChange={(e) => setEditStaffForm({ ...editStaffForm, designation: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Staff Role</label>
                  <select
                    value={editStaffForm.staffRole}
                    onChange={(e) => setEditStaffForm({ ...editStaffForm, staffRole: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-transparent"
                  >
                    <option value="Technician">Technician</option>
                    <option value="Attendant">Attendant</option>
                    <option value="Supervisor">Supervisor</option>
                    <option value="Security Officer">Security Officer</option>
                    <option value="Committee Member">Committee Member</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold">Department Assignment / Transfer</label>
                <select
                  value={editStaffForm.departmentId}
                  onChange={(e) => setEditStaffForm({ ...editStaffForm, departmentId: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-transparent"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editSupervisorCheck"
                  checked={editStaffForm.isSupervisor}
                  onChange={(e) => setEditStaffForm({ ...editStaffForm, isSupervisor: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <label htmlFor="editSupervisorCheck" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  Department Supervisor Privileges
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditStaff(false)}>Cancel</Button>
              <Button
                onClick={() => {
                  updateStaffMutation.mutate({
                    id: editStaffForm.id,
                    name: editStaffForm.name,
                    email: editStaffForm.email,
                    employeeId: editStaffForm.employeeId,
                    phoneNumber: editStaffForm.phoneNumber,
                    departmentId: editStaffForm.departmentId,
                    designation: editStaffForm.designation,
                    staffRole: editStaffForm.staffRole,
                    isSupervisor: editStaffForm.isSupervisor
                  });
                }}
                disabled={updateStaffMutation.isPending}
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* RESET PASSWORD MODAL */}
        <Dialog open={showResetPassword} onOpenChange={setShowResetPassword}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                Reset Password
              </DialogTitle>
              <DialogDescription>
                Set a new password for <strong>{resetPasswordForm.name}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-semibold">New Password (minimum 6 characters)</label>
                <Input
                  type="password"
                  placeholder="Enter new password"
                  value={resetPasswordForm.newPassword}
                  onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, newPassword: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResetPassword(false)}>Cancel</Button>
              <Button
                onClick={() => resetPasswordMutation.mutate({ id: resetPasswordForm.id, newPassword: resetPasswordForm.newPassword })}
                disabled={resetPasswordMutation.isPending || !resetPasswordForm.newPassword || resetPasswordForm.newPassword.length < 6}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                Reset Password
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* TRANSFER WORK MODAL */}
        <Dialog open={showTransferWork} onOpenChange={setShowTransferWork}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transfer Unfinished Work</DialogTitle>
              <DialogDescription>Reassign all open complaints from a departing or overloaded employee to another staff member.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-semibold">From Staff Member</label>
                <select
                  value={transferForm.fromStaffId}
                  onChange={(e) => setTransferForm({ ...transferForm, fromStaffId: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-transparent"
                >
                  <option value="">Select Source Staff</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.department}) - {s.activeWorkload} active</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold">To Staff Member</label>
                <select
                  value={transferForm.toStaffId}
                  onChange={(e) => setTransferForm({ ...transferForm, toStaffId: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-transparent"
                >
                  <option value="">Select Target Staff</option>
                  {staffList.filter(s => s.id !== transferForm.fromStaffId && s.isActive).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.department})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold">Mandatory Transfer Reason</label>
                <Input
                  placeholder="e.g. Employee on extended leave / departed hostel operations"
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTransferWork(false)}>Cancel</Button>
              <Button onClick={() => transferWorkMutation.mutate(transferForm)} disabled={transferWorkMutation.isPending}>
                Execute Work Transfer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* CREATE CATEGORY MODAL */}
        <Dialog open={showCreateCategory} onOpenChange={setShowCreateCategory}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Complaint Category</DialogTitle>
              <DialogDescription>Map a new student-facing complaint category to a target maintenance department.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-semibold">Category Name</label>
                <Input
                  placeholder="e.g. Geyser Breakdown / Hot Water"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Target Department</label>
                <select
                  value={categoryForm.departmentId}
                  onChange={(e) => setCategoryForm({ ...categoryForm, departmentId: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-transparent"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold">Default Priority</label>
                <select
                  value={categoryForm.defaultPriority}
                  onChange={(e) => setCategoryForm({ ...categoryForm, defaultPriority: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-transparent"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Emergency">Emergency</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold">Description</label>
                <Input
                  placeholder="Issue description and scope"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="confidentialCheck"
                  checked={categoryForm.isConfidential}
                  onChange={(e) => setCategoryForm({ ...categoryForm, isConfidential: e.target.checked })}
                  className="rounded border-slate-300"
                />
                <label htmlFor="confidentialCheck" className="text-xs text-slate-700 dark:text-slate-300">
                  Strict Confidentiality (Air-gapped from regular monitoring feeds)
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateCategory(false)}>Cancel</Button>
              <Button
                onClick={() => createCategoryMutation.mutate(categoryForm)}
                disabled={createCategoryMutation.isPending || !categoryForm.name || !categoryForm.departmentId}
              >
                Create Category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* CREATE INSTANCE MODAL */}
        <Dialog open={showCreateInstance} onOpenChange={setShowCreateInstance}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Dashboard Instance</DialogTitle>
              <DialogDescription>Deploy an independent workspace instance for specialized operational personnel.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-xs font-semibold">Instance Name</label>
                <Input
                  placeholder="e.g. Wi-Fi Specialist Node Beta"
                  value={instanceForm.name}
                  onChange={(e) => setInstanceForm({ ...instanceForm, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-semibold">Associated Department</label>
                <select
                  value={instanceForm.departmentId}
                  onChange={(e) => setInstanceForm({ ...instanceForm, departmentId: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-transparent"
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold">Template</label>
                <select
                  value={instanceForm.templateId}
                  onChange={(e) => setInstanceForm({ ...instanceForm, templateId: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-transparent"
                >
                  <option value="GENERAL_STAFF">General Staff</option>
                  <option value="PLUMBING_OPS">Plumbing Ops</option>
                  <option value="ELECTRICAL_OPS">Electrical Ops</option>
                  <option value="WORKSHOP_OPS">Workshop Ops</option>
                  <option value="CLEANING_OPS">Cleaning Ops</option>
                  <option value="WIFI_OPS">Wi-Fi Ops</option>
                  <option value="SECURITY_DESK">Security Desk</option>
                  <option value="ANTI_RAGGING_VAULT">Anti-Ragging Vault</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateInstance(false)}>Cancel</Button>
              <Button
                onClick={() => createInstanceMutation.mutate(instanceForm)}
                disabled={createInstanceMutation.isPending || !instanceForm.name || !instanceForm.departmentId}
              >
                Deploy Instance
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MULTIPLE PERMISSION ASSIGNMENT & CONFIRMATION MODAL */}
        <Dialog open={showPermConfirm} onOpenChange={setShowPermConfirm}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Configure Dashboard Permissions</DialogTitle>
              <DialogDescription>
                Assign operational dashboard access for <strong>{selectedStaffForPerm?.name}</strong> ({selectedStaffForPerm?.email}).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Select Accessible Operational Dashboards:
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { code: "PLUMBING", label: "Plumbing Operations" },
                  { code: "ELECTRICAL", label: "Electrical Operations" },
                  { code: "WORKSHOP", label: "Workshop & Furniture" },
                  { code: "CLEANING", label: "Cleaning & Housekeeping" },
                  { code: "WIFI", label: "Wi-Fi Operations" },
                  { code: "SECURITY", label: "Campus Security Desk" },
                  { code: "ANTI_RAGGING", label: "Anti-Ragging Squad (Confidential)" },
                ].map((item) => {
                  const isChecked = pendingPerms.includes(item.code);
                  return (
                    <label
                      key={item.code}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${isChecked ? "border-primary bg-primary/5 dark:bg-primary/10" : "border-slate-200 dark:border-slate-800"}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPendingPerms([...pendingPerms, item.code]);
                          } else {
                            setPendingPerms(pendingPerms.filter((p) => p !== item.code));
                          }
                        }}
                        className="mt-0.5 rounded border-slate-300"
                      />
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{item.label}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{item.code}</div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Exact permissions & cross-department warning */}
              {pendingPerms.length > 1 && (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-1.5 text-amber-900 dark:text-amber-200">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                    CROSS-DEPARTMENT DATA ACCESS WARNING
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Assigning multiple permissions ({pendingPerms.join(", ")}) authorizes this employee to view and handle complaints, rooms, and student contact details across {pendingPerms.length} separate departments.
                  </p>
                  <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                    By clicking Confirm, you verify that this employee has official management authorization for multi-department operations.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPermConfirm(false)}>Cancel</Button>
              <Button
                onClick={() =>
                  updatePermissionsMutation.mutate({
                    id: selectedStaffForPerm?.id,
                    dashboardPermissions: pendingPerms,
                    confirmedMultipleAccess: pendingPerms.length > 1
                  })
                }
                disabled={updatePermissionsMutation.isPending}
              >
                Confirm & Apply Permissions
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

