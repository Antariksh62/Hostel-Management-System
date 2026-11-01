import React, { useState, useEffect, useContext } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  Building,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  Filter,
  History,
  GraduationCap,
  Info,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X
} from "lucide-react";
import { toast } from "sonner";
import { AuthContext } from "@/context/AuthContext";
import api from "@/services/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const MANDATORY_FIELDS = [
  { key: "prn", label: "PRN (Student ID)" },
  { key: "name", label: "Student Full Name" },
  { key: "rollNumber", label: "Roll Number" },
  { key: "email", label: "Official Email (@ms.pict.edu)" },
  { key: "branch", label: "Branch (CE/IT/ENTC/AIDS/ECE)" },
  { key: "doorNumber", label: "Room Number (101-509)" },
  { key: "studentMobile", label: "Student Mobile (10 digits)" },
  { key: "parentMobile", label: "Parent/Guardian Mobile (10 digits)" },
  { key: "year", label: "Academic Year (FY/SY/TY)" },
  { key: "division", label: "Division / Class" }
];

export default function StudentAdmissionModule() {
  const { user } = useContext(AuthContext);

  // Tabs: 'roster' | 'upload' | 'pending' | 'approved' | 'rejected' | 'revoked' | 'registration' | 'batches' | 'audit'
  const [activeTab, setActiveTab] = useState("roster");

  // Roster state
  const [records, setRecords] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    revoked: 0,
    registered: 0,
    notRegistered: 0
  });
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [admissionFilter, setAdmissionFilter] = useState("ALL");
  const [registrationFilter, setRegistrationFilter] = useState("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");
  const [yearFilter, setYearFilter] = useState("ALL");

  // Selection for batch actions
  const [selectedIds, setSelectedIds] = useState([]);

  // Detail Drawer
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Action Modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [actionReason, setActionReason] = useState("");
  const [targetRecordId, setTargetRecordId] = useState(null);
  const [targetStudent, setTargetStudent] = useState(null);
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // Manual Add Student state
  const [addStudentModalOpen, setAddStudentModalOpen] = useState(false);
  const [addStudentForm, setAddStudentForm] = useState({
    name: "",
    email: "",
    prn: "",
    rollNumber: "",
    branch: "CE",
    year: "FY",
    division: "1",
    doorNumber: "",
    studentMobile: "",
    parentMobile: "",
    admissionStatus: "APPROVED",
    reason: "Manually registered by Administrator"
  });
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Manual Edit Student state
  const [editStudentModalOpen, setEditStudentModalOpen] = useState(false);
  const [editStudentForm, setEditStudentForm] = useState({
    id: "",
    name: "",
    prn: "",
    email: "",
    rollNumber: "",
    branch: "CE",
    year: "FY",
    division: "1",
    doorNumber: "",
    studentMobile: "",
    parentMobile: ""
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Upload & Preview state
  const [uploadFile, setUploadFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [worksheets, setWorksheets] = useState([]);
  const [selectedWorksheet, setSelectedWorksheet] = useState("");
  const [columnMappings, setColumnMappings] = useState({});
  const [detectedHeaders, setDetectedHeaders] = useState([]);
  const [unmappedColumns, setUnmappedColumns] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [importMode, setImportMode] = useState("ADD_UPDATE"); // "ADD_UPDATE" | "FULL_SYNC"
  const [confirmRevokeMissing, setConfirmRevokeMissing] = useState(false);

  // Batches and Audit state
  const [batches, setBatches] = useState([]);
  const [auditList, setAuditList] = useState([]);

  // Fetch Roster
  const fetchRoster = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("page", currentPage);
      params.append("limit", 20);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      if (admissionFilter !== "ALL") params.append("admissionStatus", admissionFilter);
      if (registrationFilter !== "ALL") params.append("registrationStatus", registrationFilter);
      if (branchFilter !== "ALL") params.append("branch", branchFilter);
      if (yearFilter !== "ALL") params.append("year", yearFilter);

      const res = await api.get(`/admissions/roster?${params.toString()}`);
      setRecords(res.data.records || []);
      setTotalRecords(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
      setStats(res.data.counts || {});
    } catch (err) {
      console.error("Failed to load roster:", err);
      toast.error(err.response?.data?.message || "Failed to load student roster");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (["roster", "pending", "approved", "rejected", "revoked", "registration"].includes(activeTab)) {
      fetchRoster();
    } else if (activeTab === "batches") {
      fetchBatches();
    } else if (activeTab === "audit") {
      fetchAudit();
    }
  }, [currentPage, admissionFilter, registrationFilter, branchFilter, yearFilter, activeTab]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchRoster();
  };

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admissions/batches");
      setBatches(res.data.batches || []);
    } catch (err) {
      toast.error("Failed to load import batches");
    } finally {
      setLoading(false);
    }
  };

  const fetchAudit = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admissions/audit-history");
      setAuditList(res.data.audit || []);
    } catch (err) {
      toast.error("Failed to load audit history");
    } finally {
      setLoading(false);
    }
  };

  // Switch tabs & sync filters
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSelectedIds([]);
    if (tab === "pending") {
      setAdmissionFilter("PENDING_APPROVAL");
    } else if (tab === "approved") {
      setAdmissionFilter("APPROVED");
    } else if (tab === "rejected") {
      setAdmissionFilter("REJECTED");
    } else if (tab === "revoked") {
      setAdmissionFilter("REVOKED");
    } else if (tab === "registration") {
      setAdmissionFilter("APPROVED");
      setRegistrationFilter("ALL");
    } else if (tab === "roster") {
      setAdmissionFilter("ALL");
      setRegistrationFilter("ALL");
    }
  };

  // Upload handling
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setPreviewData(null);

    // Fetch worksheets
    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsAnalyzing(true);
      const res = await api.post("/admissions/worksheets", formData);
      const sheets = res.data.sheets || [];
      setWorksheets(sheets);
      const defaultSheet = sheets[0] || "Sheet1";
      setSelectedWorksheet(defaultSheet);
      // Run auto-preview on default sheet
      await runPreview(file, defaultSheet);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to analyze workbook");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runPreview = async (fileToUse, sheetToUse, mappingsToUse = null, modeToUse = null) => {
    try {
      setIsAnalyzing(true);
      const effectiveMode = modeToUse || importMode;
      const formData = new FormData();
      formData.append("file", fileToUse || uploadFile);
      formData.append("mode", effectiveMode);
      if (sheetToUse || selectedWorksheet) {
        formData.append("sheetName", sheetToUse || selectedWorksheet);
      }
      if (mappingsToUse || Object.keys(columnMappings).length > 0) {
        formData.append("mappings", JSON.stringify(mappingsToUse || columnMappings));
      }

      const res = await api.post("/admissions/preview", formData);
      setPreviewData(res.data);
      setDetectedHeaders(res.data.headers || []);
      setColumnMappings(res.data.mappings || {});
      setUnmappedColumns(res.data.unmappedColumns || []);
      setConfirmRevokeMissing(false);
      toast.success(`Workbook parsed: ${res.data.summary.validCount} valid / ${res.data.summary.totalRows} total rows`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Validation preview failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCommitImport = async (autoApprove = false) => {
    if (!previewData || !previewData.rows) return;
    const validRows = previewData.rows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error("There are no valid rows to import");
      return;
    }

    if (importMode === "FULL_SYNC" && (previewData.missingStudents?.length > 0) && !confirmRevokeMissing) {
      toast.error(`Please check the confirmation box to authorize revoking the ${previewData.missingStudents.length} missing students.`);
      return;
    }

    try {
      setIsCommitting(true);
      const payload = {
        parsedRows: validRows,
        autoApprove,
        mode: importMode,
        confirmRevokeMissing: importMode === "FULL_SYNC" && confirmRevokeMissing,
        batchMeta: {
          originalFileName: uploadFile?.name || "roster_upload.xlsx",
          worksheetName: selectedWorksheet,
          mappings: columnMappings
        }
      };

      const res = await api.post("/admissions/commit", payload);
      let successMsg = autoApprove
        ? `Imported & approved ${res.data.approvedCount} students directly!`
        : `Imported ${res.data.pendingCount} students as pending approval!`;
      if (res.data.revokedMissingCount > 0) {
        successMsg += ` (${res.data.revokedMissingCount} absent students revoked via Full Roster Sync)`;
      }
      toast.success(successMsg);
      setUploadFile(null);
      setPreviewData(null);
      setConfirmRevokeMissing(false);
      handleTabChange(autoApprove ? "approved" : "pending");
    } catch (err) {
      toast.error(err.response?.data?.message || "Commit failed");
    } finally {
      setIsCommitting(false);
    }
  };

  // Actions: Approve
  const handleApprove = async (idOrIds) => {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    try {
      setIsSubmittingAction(true);
      const res = await api.post("/admissions/approve", { ids });
      toast.success(res.data.message);
      if (res.data.skippedCount > 0) {
        toast.warning(`${res.data.skippedCount} student(s) skipped due to full room capacity.`);
      }
      setSelectedIds([]);
      fetchRoster();
      if (isDetailOpen && selectedRecord) {
        // Refresh details
        const updated = await api.get(`/admissions/roster/${selectedRecord._id}`);
        setSelectedRecord(updated.data.record);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Approval failed");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Actions: Reject
  const triggerReject = (idOrIds) => {
    setTargetRecordId(idOrIds);
    setActionReason("");
    setRejectModalOpen(true);
  };

  const submitReject = async () => {
    if (!actionReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }
    const ids = Array.isArray(targetRecordId) ? targetRecordId : [targetRecordId];
    try {
      setIsSubmittingAction(true);
      const res = await api.post("/admissions/reject", { ids, reason: actionReason.trim() });
      toast.success(res.data.message);
      setRejectModalOpen(false);
      setSelectedIds([]);
      fetchRoster();
      if (isDetailOpen && selectedRecord) {
        const updated = await api.get(`/admissions/roster/${selectedRecord._id}`);
        setSelectedRecord(updated.data.record);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Rejection failed");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Actions: Revoke
  const triggerRevoke = (recordOrId) => {
    if (typeof recordOrId === "object" && recordOrId !== null) {
      setTargetRecordId(recordOrId._id);
      setTargetStudent(recordOrId);
    } else {
      setTargetRecordId(recordOrId);
      const found = records.find(r => r._id === recordOrId);
      setTargetStudent(found || null);
    }
    setActionReason("");
    setRevokeModalOpen(true);
  };

  const submitRevoke = async () => {
    if (!actionReason.trim()) {
      toast.error("A reason is required to revoke registration eligibility");
      return;
    }
    try {
      setIsSubmittingAction(true);
      const res = await api.post("/admissions/revoke", { id: targetRecordId, reason: actionReason.trim() });
      toast.success(res.data.message);
      setRevokeModalOpen(false);
      setTargetStudent(null);
      fetchRoster();
      if (isDetailOpen && selectedRecord) {
        const updated = await api.get(`/admissions/roster/${selectedRecord._id}`);
        setSelectedRecord(updated.data.record);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Revocation failed");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Actions: Manual Add Student
  const submitAddStudent = async (e) => {
    e.preventDefault();
    if (!addStudentForm.name.trim()) return toast.error("Student name is required");
    if (!addStudentForm.email.trim()) return toast.error("Official PICT email is required");
    if (!addStudentForm.email.toLowerCase().trim().endsWith("@ms.pict.edu")) {
      return toast.error("Only official @ms.pict.edu email addresses are allowed");
    }
    if (!addStudentForm.prn.trim()) return toast.error("PRN is required");

    try {
      setIsSubmittingAdd(true);
      const res = await api.post("/admissions/student", addStudentForm);
      toast.success(res.data.message || "Student added to roster successfully!");
      setAddStudentModalOpen(false);
      setAddStudentForm({
        name: "",
        email: "",
        prn: "",
        rollNumber: "",
        branch: "CE",
        year: "FY",
        division: "1",
        doorNumber: "",
        studentMobile: "",
        parentMobile: "",
        admissionStatus: "APPROVED",
        reason: "Manually registered by Administrator"
      });
      fetchRoster();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add student to roster");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Actions: Manual Edit Student
  const triggerEdit = (record) => {
    setEditStudentForm({
      id: record._id,
      name: record.name || "",
      prn: record.prn || "",
      email: record.email || "",
      rollNumber: record.rollNumber || "",
      branch: record.branch || "CE",
      year: record.year || "FY",
      division: record.division || "1",
      doorNumber: record.doorNumber || "",
      studentMobile: record.studentMobile || "",
      parentMobile: record.parentMobile || ""
    });
    setEditStudentModalOpen(true);
  };

  const submitEditStudent = async (e) => {
    e.preventDefault();
    if (!editStudentForm.name.trim()) return toast.error("Student name is required");

    try {
      setIsSubmittingEdit(true);
      const res = await api.patch(`/admissions/student/${editStudentForm.id}`, editStudentForm);
      toast.success(res.data.message || "Student details updated successfully!");
      setEditStudentModalOpen(false);
      fetchRoster();
      if (isDetailOpen && selectedRecord && selectedRecord._id === editStudentForm.id) {
        const updated = await api.get(`/admissions/roster/${selectedRecord._id}`);
        setSelectedRecord(updated.data.record);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update student details");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Actions: Restore
  const handleRestore = async (id) => {
    try {
      setIsSubmittingAction(true);
      const res = await api.post("/admissions/restore", { id });
      toast.success(res.data.message);
      fetchRoster();
      if (isDetailOpen && selectedRecord) {
        const updated = await api.get(`/admissions/roster/${selectedRecord._id}`);
        setSelectedRecord(updated.data.record);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Restoration failed");
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Export Roster
  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (admissionFilter !== "ALL") params.append("admissionStatus", admissionFilter);
    if (branchFilter !== "ALL") params.append("branch", branchFilter);
    if (yearFilter !== "ALL") params.append("year", yearFilter);

    const token = localStorage.getItem("token");
    window.open(`/api/admissions/export?${params.toString()}&token=${token}`, "_blank");
  };

  const handleDownloadTemplate = () => {
    const token = localStorage.getItem("token");
    window.open(`/api/admissions/template?token=${token}`, "_blank");
  };

  const openRecordDetails = async (id) => {
    try {
      const res = await api.get(`/admissions/roster/${id}`);
      setSelectedRecord(res.data.record);
      setIsDetailOpen(true);
    } catch (err) {
      toast.error("Failed to load record details");
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "APPROVED":
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Approved</Badge>;
      case "PENDING_APPROVAL":
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">Pending Approval</Badge>;
      case "REJECTED":
        return <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30">Rejected</Badge>;
      case "REVOKED":
        return <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30">Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRegistrationBadge = (status) => {
    switch (status) {
      case "REGISTERED":
        return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30">Registered</Badge>;
      case "REGISTRATION_STARTED":
        return <Badge className="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">In Progress</Badge>;
      case "NOT_REGISTERED":
        return <Badge variant="outline" className="text-muted-foreground">Not Registered</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="size-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Student Admission & Eligibility</h1>
              <p className="text-xs text-muted-foreground">
                Centralized hostel roster management, Excel import with column recognition, and OTP eligibility control.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            className="h-8.5 text-xs font-medium gap-1.5 cursor-pointer"
          >
            <Download className="size-3.5" />
            Download Template
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8.5 text-xs font-medium gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="size-3.5" />
            Export Roster
          </Button>

          <Button
            size="sm"
            onClick={() => setAddStudentModalOpen(true)}
            className="h-8.5 text-xs font-semibold gap-1.5 cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs"
          >
            <UserPlus className="size-3.5" />
            Add Student
          </Button>

          <Button
            size="sm"
            onClick={() => handleTabChange("upload")}
            className="h-8.5 text-xs font-semibold gap-1.5 cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Upload className="size-3.5" />
            Upload Excel Roster
          </Button>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <div
          onClick={() => handleTabChange("roster")}
          className={cn(
            "rounded-xl border border-border bg-card p-3 shadow-2xs transition-colors cursor-pointer hover:border-primary/50",
            activeTab === "roster" && "border-primary bg-primary/5"
          )}
        >
          <span className="text-[11px] font-semibold text-muted-foreground">Total Roster</span>
          <div className="mt-1 text-xl font-bold tracking-tight text-foreground">{stats.total}</div>
        </div>

        <div
          onClick={() => handleTabChange("pending")}
          className={cn(
            "rounded-xl border border-border bg-card p-3 shadow-2xs transition-colors cursor-pointer hover:border-amber-500/50",
            activeTab === "pending" && "border-amber-500 bg-amber-500/5"
          )}
        >
          <span className="text-[11px] font-semibold text-amber-500">Pending Approval</span>
          <div className="mt-1 text-xl font-bold tracking-tight text-amber-500">{stats.pending}</div>
        </div>

        <div
          onClick={() => handleTabChange("approved")}
          className={cn(
            "rounded-xl border border-border bg-card p-3 shadow-2xs transition-colors cursor-pointer hover:border-emerald-500/50",
            activeTab === "approved" && "border-emerald-500 bg-emerald-500/5"
          )}
        >
          <span className="text-[11px] font-semibold text-emerald-500">Approved Eligible</span>
          <div className="mt-1 text-xl font-bold tracking-tight text-emerald-500">{stats.approved}</div>
        </div>

        <div
          onClick={() => handleTabChange("rejected")}
          className={cn(
            "rounded-xl border border-border bg-card p-3 shadow-2xs transition-colors cursor-pointer hover:border-red-500/50",
            activeTab === "rejected" && "border-red-500 bg-red-500/5"
          )}
        >
          <span className="text-[11px] font-semibold text-red-500">Rejected</span>
          <div className="mt-1 text-xl font-bold tracking-tight text-red-500">{stats.rejected}</div>
        </div>

        <div
          onClick={() => handleTabChange("revoked")}
          className={cn(
            "rounded-xl border border-border bg-card p-3 shadow-2xs transition-colors cursor-pointer hover:border-purple-500/50",
            activeTab === "revoked" && "border-purple-500 bg-purple-500/5"
          )}
        >
          <span className="text-[11px] font-semibold text-purple-500">Revoked</span>
          <div className="mt-1 text-xl font-bold tracking-tight text-purple-500">{stats.revoked}</div>
        </div>

        <div
          onClick={() => handleTabChange("registration")}
          className={cn(
            "rounded-xl border border-border bg-card p-3 shadow-2xs transition-colors cursor-pointer hover:border-blue-500/50",
            activeTab === "registration" && "border-blue-500 bg-blue-500/5"
          )}
        >
          <span className="text-[11px] font-semibold text-blue-500">Registered</span>
          <div className="mt-1 text-xl font-bold tracking-tight text-blue-500">{stats.registered}</div>
        </div>

        <div
          onClick={() => handleTabChange("registration")}
          className="rounded-xl border border-border bg-card p-3 shadow-2xs transition-colors cursor-pointer"
        >
          <span className="text-[11px] font-semibold text-muted-foreground">Unregistered</span>
          <div className="mt-1 text-xl font-bold tracking-tight text-foreground">{stats.notRegistered}</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2 text-xs">
        {[
          { key: "roster", label: "Student Roster", icon: Users },
          { key: "upload", label: "Upload Excel", icon: Upload },
          { key: "pending", label: `Pending (${stats.pending})`, icon: Clock },
          { key: "approved", label: `Approved (${stats.approved})`, icon: ShieldCheck },
          { key: "rejected", label: `Rejected (${stats.rejected})`, icon: UserX },
          { key: "revoked", label: `Revoked (${stats.revoked})`, icon: ShieldAlert },
          { key: "registration", label: "Registration Status", icon: UserCheck },
          { key: "batches", label: "Import History", icon: History },
          { key: "audit", label: "Audit Log", icon: FileCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 font-medium transition-colors cursor-pointer",
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB: UPLOAD EXCEL ROSTER                                                   */}
      {/* ========================================================================= */}
      {activeTab === "upload" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
            <h2 className="text-base font-bold text-foreground">Import Student Roster from Spreadsheet</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload official college allotment sheets in Excel (.xlsx, .xls) or CSV format. Column orders and headers are automatically detected with manual correction support.
            </p>

            {/* Import Mode Selector */}
            <div className="mt-4 p-3.5 rounded-xl border border-border bg-muted/20 space-y-2.5">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">Select Import Mode</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                    importMode === "ADD_UPDATE"
                      ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                      : "border-border bg-card text-muted-foreground hover:border-border/80"
                  )}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="ADD_UPDATE"
                    checked={importMode === "ADD_UPDATE"}
                    onChange={(e) => {
                      setImportMode(e.target.value);
                      if (uploadFile) runPreview(uploadFile, selectedWorksheet, null, e.target.value);
                    }}
                    className="mt-0.5 text-primary"
                  />
                  <div>
                    <span className="text-xs font-bold block text-foreground">Mode A — Add / Update Only (Standard)</span>
                    <span className="text-[11px] text-muted-foreground block mt-0.5">
                      Adds new students & updates existing records. Preserves students absent from this upload (no automatic revocations).
                    </span>
                  </div>
                </label>

                <label
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                    importMode === "FULL_SYNC"
                      ? "border-amber-500 bg-amber-500/5 text-foreground ring-1 ring-amber-500/30"
                      : "border-border bg-card text-muted-foreground hover:border-border/80"
                  )}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="FULL_SYNC"
                    checked={importMode === "FULL_SYNC"}
                    onChange={(e) => {
                      setImportMode(e.target.value);
                      if (uploadFile) runPreview(uploadFile, selectedWorksheet, null, e.target.value);
                    }}
                    className="mt-0.5 text-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold block text-amber-600 dark:text-amber-400">Mode B — Full Roster Synchronization</span>
                    <span className="text-[11px] text-muted-foreground block mt-0.5">
                      Authoritative full roster sync. Identifies active students missing from the workbook and revokes their eligibility upon explicit confirmation.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Drop / Browse area */}
            <div className="mt-5 flex justify-center rounded-xl border border-dashed border-border px-6 py-10 transition-colors hover:border-primary/60 bg-muted/20">
              <div className="text-center">
                <FileSpreadsheet className="mx-auto size-12 text-muted-foreground/60" />
                <div className="mt-4 flex text-xs leading-6 text-muted-foreground justify-center">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer rounded-md font-semibold text-primary focus-within:outline-none hover:underline"
                  >
                    <span>Choose spreadsheet file</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="sr-only"
                      onChange={handleFileSelect}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-[11px] text-muted-foreground">Excel .xlsx, .xls or .csv up to 15MB</p>
                {uploadFile && (
                  <p className="mt-2 text-xs font-semibold text-emerald-500">
                    Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            </div>

            {/* Loading indicator */}
            {isAnalyzing && (
              <div className="mt-4 flex items-center justify-center gap-2 py-4 text-xs font-medium text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                Analyzing spreadsheet columns, identity fields, and 77-room capacity...
              </div>
            )}

            {/* Worksheet & Column Mapping Configuration */}
            {previewData && !isAnalyzing && (
              <div className="mt-6 space-y-6 border-t border-border pt-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Worksheet & Column Mapping Preview</h3>
                    <p className="text-xs text-muted-foreground">
                      Verify that each student identity field correctly matches your spreadsheet's column.
                    </p>
                  </div>

                  {worksheets.length > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Select Sheet:</span>
                      <select
                        value={selectedWorksheet}
                        onChange={(e) => {
                          setSelectedWorksheet(e.target.value);
                          runPreview(uploadFile, e.target.value);
                        }}
                        className="h-8.5 rounded-lg border border-border bg-background px-3 text-xs font-medium"
                      >
                        {worksheets.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Column Mapping Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {MANDATORY_FIELDS.map((f) => (
                    <div key={f.key} className="rounded-lg border border-border p-3 bg-muted/10 space-y-1">
                      <label className="text-[11px] font-bold text-foreground block truncate">
                        {f.label}
                      </label>
                      <select
                        value={columnMappings[f.key] || ""}
                        onChange={(e) => {
                          const updated = { ...columnMappings, [f.key]: e.target.value };
                          setColumnMappings(updated);
                          runPreview(uploadFile, selectedWorksheet, updated);
                        }}
                        className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                      >
                        <option value="">-- Select Column --</option>
                        {detectedHeaders.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Unmapped columns alert */}
                {unmappedColumns.length > 0 && (
                  <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-xs text-muted-foreground flex items-start gap-2">
                    <Info className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="font-semibold text-foreground">Unmapped Spreadsheet Columns: </span>
                      {unmappedColumns.join(", ")}
                      <p className="mt-0.5 text-[11px]">These columns will be safely ignored during student admission import.</p>
                    </div>
                  </div>
                )}

                {/* Dry-Run Validation Metrics Strip */}
                <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">Validation & Capacity Analysis</span>
                    <span className="text-xs text-muted-foreground font-medium">Zero database writes until confirmed</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="rounded-lg border border-border bg-card p-2.5 text-center">
                      <span className="text-[11px] text-muted-foreground">Total Rows</span>
                      <div className="text-lg font-bold text-foreground">{previewData.summary.totalRows}</div>
                    </div>
                    <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-2.5 text-center">
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Valid Records</span>
                      <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{previewData.summary.validCount}</div>
                    </div>
                    <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-2.5 text-center">
                      <span className="text-[11px] text-red-600 dark:text-red-400 font-medium">Invalid Records</span>
                      <div className="text-lg font-bold text-red-600 dark:text-red-400">{previewData.summary.invalidCount}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-2.5 text-center">
                      <span className="text-[11px] text-muted-foreground font-medium">Existing Matched</span>
                      <div className="text-lg font-bold text-foreground">{previewData.summary.existingMatchedCount}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-2.5 text-center">
                      <span className="text-[11px] text-muted-foreground font-medium">New Candidates</span>
                      <div className="text-lg font-bold text-foreground">{previewData.summary.newCandidateCount}</div>
                    </div>
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 text-center">
                      <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Over-Capacity</span>
                      <div className="text-lg font-bold text-amber-600 dark:text-amber-400">{previewData.summary.overCapacityCount}</div>
                    </div>
                  </div>

                  {/* Over-Capacity Rooms Detailed Alert */}
                  {previewData.overCapacityRooms?.length > 0 && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300 space-y-1">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertTriangle className="size-4 text-red-500" />
                        <span>Room Capacity Violation: Maximum 2 Students Per Room</span>
                      </div>
                      <p>
                        The following room assignments exceed the strict hostel limit of 2 students per room and cannot be approved:
                      </p>
                      <ul className="list-disc pl-5 mt-1 space-y-0.5">
                        {previewData.overCapacityRooms.map((o) => (
                          <li key={o.room}>
                            Room <strong>{o.room}</strong>: Currently has {o.current} occupant(s) + proposed {o.projected - o.current} = {o.projected} students (Limit: {o.max})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Mode B Full Sync: Missing Students Warning Card */}
                  {importMode === "FULL_SYNC" && (
                    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200 text-xs">
                          <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                          <span>Full Sync Audit: {previewData.missingStudents?.length || 0} Active Student(s) Absent from Workbook</span>
                        </div>
                        <Badge variant="outline" className="border-amber-500/50 text-amber-600 text-[10px]">
                          Revocation Pending
                        </Badge>
                      </div>

                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        These students currently have active hostel admission status in the system, but are <strong>not present</strong> in this uploaded file. Committing Full Sync will revoke their login eligibility and release their room reservations:
                      </p>

                      {previewData.missingStudents?.length > 0 ? (
                        <div className="max-h-40 overflow-auto rounded-md border border-amber-500/30 bg-background/60">
                          <table className="w-full text-left text-[11px]">
                            <thead className="bg-muted/70 border-b border-border font-semibold">
                              <tr>
                                <th className="p-2">PRN</th>
                                <th className="p-2">Name</th>
                                <th className="p-2">Official Email</th>
                                <th className="p-2">Room</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                              {previewData.missingStudents.map((m) => (
                                <tr key={m._id || m.prn}>
                                  <td className="p-2 font-mono">{m.prn}</td>
                                  <td className="p-2 font-medium">{m.name}</td>
                                  <td className="p-2 text-muted-foreground">{m.email}</td>
                                  <td className="p-2">{m.doorNumber || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          ✓ No missing active students detected. All current active students are accounted for in this workbook.
                        </p>
                      )}

                      {previewData.missingStudents?.length > 0 && (
                        <label className="flex items-start gap-2.5 pt-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={confirmRevokeMissing}
                            onChange={(e) => setConfirmRevokeMissing(e.target.checked)}
                            className="mt-0.5 rounded border-border text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-xs font-bold text-amber-900 dark:text-amber-100">
                            I explicitly confirm that these {previewData.missingStudents.length} missing student(s) will have their login access revoked.
                          </span>
                        </label>
                      )}
                    </div>
                  )}
                </div>

                {/* Preview Table of Rows */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Preview Rows (First 100)</h4>
                    <span className="text-xs text-muted-foreground">
                      Only valid records will be imported. Missing students are never deleted.
                    </span>
                  </div>

                  <div className="max-h-[380px] overflow-auto rounded-lg border border-border">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-muted border-b border-border font-semibold text-foreground">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">PRN</th>
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Official Email</th>
                          <th className="p-2.5">Room</th>
                          <th className="p-2.5">Branch</th>
                          <th className="p-2.5">Student Mobile</th>
                          <th className="p-2.5">Parent Mobile</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Validation Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60 bg-card">
                        {previewData.rows.slice(0, 100).map((row) => (
                          <tr key={row.rowNumber} className={cn(!row.isValid && "bg-red-500/5")}>
                            <td className="p-2.5 text-muted-foreground">{row.rowNumber}</td>
                            <td className="p-2.5 font-mono font-medium">{row.data.prn || "—"}</td>
                            <td className="p-2.5 font-medium">{row.data.name || "—"}</td>
                            <td className="p-2.5 text-muted-foreground">{row.data.email || "—"}</td>
                            <td className="p-2.5 font-bold">{row.data.doorNumber || "—"}</td>
                            <td className="p-2.5">{row.data.branch || "—"}</td>
                            <td className="p-2.5 font-mono text-[11px]">{row.data.studentMobile || "—"}</td>
                            <td className="p-2.5 font-mono text-[11px]">{row.data.parentMobile || "—"}</td>
                            <td className="p-2.5">
                              {row.isValid ? (
                                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">Valid</Badge>
                              ) : (
                                <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px]">Invalid</Badge>
                              )}
                            </td>
                            <td className="p-2.5 text-[11px] max-w-xs">
                              {row.errors.length > 0 ? (
                                <span className="text-red-500 font-medium">{row.errors.join("; ")}</span>
                              ) : row.isExisting ? (
                                <span className="text-blue-500">Matches existing student</span>
                              ) : (
                                <span className="text-muted-foreground">New student candidate</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Final Commit Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUploadFile(null);
                      setPreviewData(null);
                    }}
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>

                  <Button
                    variant="outline"
                    disabled={isCommitting || previewData.summary.validCount === 0}
                    onClick={() => handleCommitImport(false)}
                    className="cursor-pointer gap-2"
                  >
                    {isCommitting ? <Loader2 className="size-4 animate-spin" /> : <Clock className="size-4" />}
                    Import as Pending Approval ({previewData.summary.validCount})
                  </Button>

                  <Button
                    disabled={isCommitting || previewData.summary.validCount === 0 || previewData.summary.overCapacityCount > 0}
                    onClick={() => handleCommitImport(true)}
                    className="cursor-pointer gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  >
                    {isCommitting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                    Import & Approve Valid Records ({previewData.summary.validCount})
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: ROSTER / PENDING / APPROVED / REJECTED / REVOKED / REGISTRATION       */}
      {/* ========================================================================= */}
      {["roster", "pending", "approved", "rejected", "revoked", "registration"].includes(activeTab) && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search student by name, PRN, roll no, email, room, or mobile..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9.5 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeTab === "roster" && (
                  <select
                    value={admissionFilter}
                    onChange={(e) => {
                      setAdmissionFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9.5 rounded-lg border border-border bg-background px-3 text-xs font-medium"
                  >
                    <option value="ALL">All Admission Status</option>
                    <option value="APPROVED">Approved Only</option>
                    <option value="PENDING_APPROVAL">Pending Approval</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="REVOKED">Revoked</option>
                  </select>
                )}

                <select
                  value={registrationFilter}
                  onChange={(e) => {
                    setRegistrationFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9.5 rounded-lg border border-border bg-background px-3 text-xs font-medium"
                >
                  <option value="ALL">All Registration Status</option>
                  <option value="REGISTERED">Registered</option>
                  <option value="REGISTRATION_STARTED">Registration Started</option>
                  <option value="NOT_REGISTERED">Not Registered</option>
                </select>

                <select
                  value={branchFilter}
                  onChange={(e) => {
                    setBranchFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9.5 rounded-lg border border-border bg-background px-3 text-xs font-medium"
                >
                  <option value="ALL">All Branches</option>
                  <option value="CE">CE</option>
                  <option value="IT">IT</option>
                  <option value="ENTC">ENTC</option>
                  <option value="AIDS">AIDS</option>
                  <option value="ECE">ECE</option>
                </select>

                <select
                  value={yearFilter}
                  onChange={(e) => {
                    setYearFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-9.5 rounded-lg border border-border bg-background px-3 text-xs font-medium"
                >
                  <option value="ALL">All Years</option>
                  <option value="FY">FY</option>
                  <option value="SY">SY</option>
                  <option value="TY">TY</option>
                </select>

                <Button type="submit" size="sm" className="h-9.5 px-4 text-xs font-semibold cursor-pointer">
                  Search
                </Button>

                {(searchQuery || admissionFilter !== "ALL" || registrationFilter !== "ALL" || branchFilter !== "ALL" || yearFilter !== "ALL") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setAdmissionFilter(activeTab === "pending" ? "PENDING_APPROVAL" : activeTab === "approved" ? "APPROVED" : activeTab === "rejected" ? "REJECTED" : activeTab === "revoked" ? "REVOKED" : "ALL");
                      setRegistrationFilter("ALL");
                      setBranchFilter("ALL");
                      setYearFilter("ALL");
                      setCurrentPage(1);
                    }}
                    className="h-9.5 text-xs text-muted-foreground cursor-pointer"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </form>

            {/* Batch actions bar when items are selected */}
            {selectedIds.length > 0 && (
              <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
                <span className="font-semibold text-primary">
                  {selectedIds.length} student record(s) selected
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleApprove(selectedIds)}
                    disabled={isSubmittingAction}
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                  >
                    Approve Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => triggerReject(selectedIds)}
                    disabled={isSubmittingAction}
                    className="h-7 text-xs cursor-pointer"
                  >
                    Reject Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedIds([])}
                    className="h-7 text-xs cursor-pointer"
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Roster Data Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/60 font-semibold text-foreground">
                  <tr>
                    <th className="p-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === records.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(records.map((r) => r._id));
                          else setSelectedIds([]);
                        }}
                        className="rounded border-border"
                      />
                    </th>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">PRN</th>
                    <th className="p-3">Roll No</th>
                    <th className="p-3">Room</th>
                    <th className="p-3">Branch & Year</th>
                    <th className="p-3">Official Email</th>
                    <th className="p-3">Phone Numbers</th>
                    <th className="p-3">Admission</th>
                    <th className="p-3">Registration</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {loading ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-xs text-muted-foreground">
                        <Loader2 className="size-5 animate-spin mx-auto text-primary mb-2" />
                        Loading student roster...
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-xs text-muted-foreground">
                        No student admission records found matching current criteria.
                      </td>
                    </tr>
                  ) : (
                    records.map((r) => {
                      const isSelected = selectedIds.includes(r._id);
                      return (
                        <tr
                          key={r._id}
                          className={cn(
                            "hover:bg-muted/40 transition-colors",
                            isSelected && "bg-primary/5"
                          )}
                        >
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedIds([...selectedIds, r._id]);
                                else setSelectedIds(selectedIds.filter((id) => id !== r._id));
                              }}
                              className="rounded border-border"
                            />
                          </td>
                          <td className="p-3 font-semibold text-foreground">
                            {r.name}
                          </td>
                          <td className="p-3 font-mono font-medium">{r.prn}</td>
                          <td className="p-3">{r.rollNumber}</td>
                          <td className="p-3 font-bold text-foreground">
                            Room {r.doorNumber}
                          </td>
                          <td className="p-3">
                            <span className="font-semibold">{r.branch}</span> ({r.year || "FY"})
                          </td>
                          <td className="p-3 text-muted-foreground font-mono text-[11px] truncate max-w-[150px]">
                            {r.email}
                          </td>
                          <td className="p-3 text-[11px] space-y-0.5">
                            <div><span className="text-muted-foreground">Std:</span> {r.studentMobile || "—"}</div>
                            <div><span className="text-muted-foreground">Par:</span> {r.parentMobile || "—"}</div>
                          </td>
                          <td className="p-3">{getStatusBadge(r.admissionStatus)}</td>
                          <td className="p-3">{getRegistrationBadge(r.registrationStatus)}</td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                title="View details"
                                onClick={() => openRecordDetails(r._id)}
                                className="size-7 cursor-pointer"
                              >
                                <Eye className="size-3.5" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                title="Edit Student Details"
                                onClick={() => triggerEdit(r)}
                                className="size-7 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10 cursor-pointer"
                              >
                                <Pencil className="size-3.5" />
                              </Button>

                              {r.admissionStatus !== "APPROVED" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Approve Eligibility"
                                  onClick={() => handleApprove(r._id)}
                                  className="size-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 cursor-pointer"
                                >
                                  <ShieldCheck className="size-3.5" />
                                </Button>
                              )}

                              {r.admissionStatus === "PENDING_APPROVAL" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Reject Application"
                                  onClick={() => triggerReject(r._id)}
                                  className="size-7 text-red-600 hover:text-red-700 hover:bg-red-500/10 cursor-pointer"
                                >
                                  <UserX className="size-3.5" />
                                </Button>
                              )}

                              {r.admissionStatus === "APPROVED" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Revoke Login Access"
                                  onClick={() => triggerRevoke(r)}
                                  className="size-7 text-purple-600 hover:text-purple-700 hover:bg-purple-500/10 cursor-pointer"
                                >
                                  <ShieldAlert className="size-3.5" />
                                </Button>
                              )}

                              {r.admissionStatus === "REVOKED" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Restore Eligibility"
                                  onClick={() => handleRestore(r._id)}
                                  className="size-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 cursor-pointer"
                                >
                                  <RotateCcw className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>
                Showing {records.length} of {totalRecords} student record(s)
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage <= 1 || loading}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="size-7 cursor-pointer"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <span className="px-2 font-medium text-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  disabled={currentPage >= totalPages || loading}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="size-7 cursor-pointer"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: IMPORT BATCHES HISTORY                                               */}
      {/* ========================================================================= */}
      {activeTab === "batches" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
          <div className="border-b border-border p-4">
            <h3 className="text-sm font-bold text-foreground">Spreadsheet Roster Import History</h3>
            <p className="text-xs text-muted-foreground">
              Audit log of all uploaded workbooks, total rows processed, and approval outcomes.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 border-b border-border font-semibold text-foreground">
                <tr>
                  <th className="p-3">Batch ID</th>
                  <th className="p-3">File Name</th>
                  <th className="p-3">Worksheet</th>
                  <th className="p-3">Uploaded By</th>
                  <th className="p-3">Total Rows</th>
                  <th className="p-3">Valid</th>
                  <th className="p-3">Approved</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {batches.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-xs text-muted-foreground">
                      No import batch history found.
                    </td>
                  </tr>
                ) : (
                  batches.map((b) => (
                    <tr key={b._id}>
                      <td className="p-3 font-mono font-medium">{b.batchId}</td>
                      <td className="p-3 font-semibold text-foreground">{b.originalFileName}</td>
                      <td className="p-3 text-muted-foreground">{b.worksheetName || "Sheet1"}</td>
                      <td className="p-3">
                        {b.uploadedBy?.name} ({b.uploadedBy?.role})
                      </td>
                      <td className="p-3 font-bold">{b.totalRows}</td>
                      <td className="p-3 text-emerald-500 font-semibold">{b.validRows}</td>
                      <td className="p-3 text-emerald-500 font-semibold">{b.approvedRows}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px]">{b.outcome || "COMPLETED"}</Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {new Date(b.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: ADMISSION AUDIT LOG                                                   */}
      {/* ========================================================================= */}
      {activeTab === "audit" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
          <div className="border-b border-border p-4">
            <h3 className="text-sm font-bold text-foreground">Admission & Eligibility Audit Trail</h3>
            <p className="text-xs text-muted-foreground">
              Immutable record of every status transition, approval, rejection, and revocation.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/60 border-b border-border font-semibold text-foreground">
                <tr>
                  <th className="p-3">Action</th>
                  <th className="p-3">Student</th>
                  <th className="p-3">PRN</th>
                  <th className="p-3">Room</th>
                  <th className="p-3">Performed By</th>
                  <th className="p-3">Reason / Details</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {auditList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditList.map((a, idx) => (
                    <tr key={idx}>
                      <td className="p-3 font-mono font-bold text-primary">{a.action}</td>
                      <td className="p-3 font-semibold text-foreground">{a.studentName}</td>
                      <td className="p-3 font-mono">{a.prn}</td>
                      <td className="p-3 font-bold">Room {a.doorNumber}</td>
                      <td className="p-3">
                        {a.performedBy?.name} ({a.performedBy?.role})
                      </td>
                      <td className="p-3 text-muted-foreground max-w-xs truncate">
                        {a.details?.reason || JSON.stringify(a.details || {})}
                      </td>
                      <td className="p-3 text-muted-foreground font-mono text-[11px]">
                        {new Date(a.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECORD DETAILS DRAWER / SHEET                                              */}
      {/* ========================================================================= */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
          <SheetHeader className="border-b border-border p-5 text-left">
            <SheetTitle className="text-base font-bold text-foreground">
              {selectedRecord?.name}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              PRN: {selectedRecord?.prn} · Hostel Room {selectedRecord?.doorNumber}
            </SheetDescription>
          </SheetHeader>

          {selectedRecord && (
            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
              {/* Status Banner */}
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
                <div>
                  <span className="text-[11px] text-muted-foreground block font-medium">Admission Eligibility</span>
                  <div className="mt-0.5">{getStatusBadge(selectedRecord.admissionStatus)}</div>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block font-medium">OTP Registration</span>
                  <div className="mt-0.5">{getRegistrationBadge(selectedRecord.registrationStatus)}</div>
                </div>
              </div>

              {selectedRecord.rejectionReason && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-600 dark:text-red-400">
                  <span className="font-bold">Reason: </span>
                  {selectedRecord.rejectionReason}
                </div>
              )}

              {/* Student Details Grid */}
              <div className="space-y-3">
                <h4 className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">Student Information</h4>
                <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-border p-3">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Full Name</span>
                    <span className="font-semibold text-foreground">{selectedRecord.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Roll Number</span>
                    <span className="font-semibold text-foreground">{selectedRecord.rollNumber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Branch & Year</span>
                    <span className="font-semibold text-foreground">{selectedRecord.branch} ({selectedRecord.year || "FY"})</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Division</span>
                    <span className="font-semibold text-foreground">{selectedRecord.division || "—"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground block text-[11px]">Official Email</span>
                    <span className="font-mono text-foreground">{selectedRecord.email}</span>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-3">
                <h4 className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">Verified Contact Details</h4>
                <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-border p-3">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Student Mobile</span>
                    <span className="font-mono font-semibold text-foreground">{selectedRecord.studentMobile}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Parent / Guardian Mobile</span>
                    <span className="font-mono font-semibold text-foreground">{selectedRecord.parentMobile}</span>
                  </div>
                </div>
              </div>

              {/* Status History Timeline */}
              <div className="space-y-3">
                <h4 className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">Eligibility Status History</h4>
                <div className="rounded-lg border border-border divide-y divide-border/60">
                  {(selectedRecord.statusHistory || []).map((sh, idx) => (
                    <div key={idx} className="p-2.5 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">
                          {sh.fromStatus} → {sh.toStatus}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(sh.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-muted-foreground">{sh.reason || "Status updated"}</p>
                      <span className="text-[10px] text-muted-foreground/80 block">
                        By: {sh.changedBy?.name} ({sh.changedBy?.role})
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Drawer Actions */}
              <div className="pt-4 border-t border-border flex flex-wrap gap-2">
                {selectedRecord.admissionStatus !== "APPROVED" && (
                  <Button
                    size="sm"
                    onClick={() => handleApprove(selectedRecord._id)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                  >
                    Approve Registration Eligibility
                  </Button>
                )}

                {selectedRecord.admissionStatus === "APPROVED" && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => triggerRevoke(selectedRecord._id)}
                    className="flex-1 font-semibold cursor-pointer"
                  >
                    Revoke Eligibility
                  </Button>
                )}

                {selectedRecord.admissionStatus === "REVOKED" && (
                  <Button
                    size="sm"
                    onClick={() => handleRestore(selectedRecord._id)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                  >
                    Restore Eligibility
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ========================================================================= */}
      {/* REJECT MODAL                                                              */}
      {/* ========================================================================= */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Reject Student Admission Application
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Please state an explicit rejection reason for administrative records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-semibold text-foreground">Rejection Reason</label>
            <textarea
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="e.g. Incomplete verification documents / duplicate allotment"
              className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isSubmittingAction || !actionReason.trim()}
              onClick={submitReject}
              className="cursor-pointer"
            >
              {isSubmittingAction ? <Loader2 className="size-4 animate-spin" /> : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* REVOKE ELIGIBILITY MODAL                                                  */}
      {/* ========================================================================= */}
      <Dialog open={revokeModalOpen} onOpenChange={setRevokeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Revoke Student Login Eligibility
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Revoking eligibility blocks OTP authentication and immediately terminates any active sessions.
            </DialogDescription>
          </DialogHeader>

          {targetStudent && (
            <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3 text-xs space-y-1">
              <div className="font-bold text-foreground">{targetStudent.name}</div>
              <div className="text-muted-foreground font-mono">{targetStudent.email} | PRN: {targetStudent.prn}</div>
              {targetStudent.doorNumber && (
                <div className="text-purple-600 dark:text-purple-400 font-semibold">Allocated Room: {targetStudent.doorNumber} (will be released)</div>
              )}
            </div>
          )}

          <div className="space-y-3 py-1">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              ⚠ The student will be prevented from requesting or verifying OTPs. Their account profile and complaint history remain preserved.
            </p>
            <label className="text-xs font-semibold text-foreground block">Reason for Revocation (Required)</label>
            <textarea
              rows={3}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="e.g. Admission cancelled / disciplinary action / fees overdue"
              className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setRevokeModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isSubmittingAction || !actionReason.trim()}
              onClick={submitRevoke}
              className="cursor-pointer"
            >
              {isSubmittingAction ? <Loader2 className="size-4 animate-spin" /> : "Confirm Revoke Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* ADD STUDENT MANUALLY MODAL                                                */}
      {/* ========================================================================= */}
      <Dialog open={addStudentModalOpen} onOpenChange={setAddStudentModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <UserPlus className="size-4.5 text-indigo-600" />
              Add Student to Admission Roster
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Manually register an individual student. Only approved students can authenticate via OTP.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitAddStudent} className="space-y-3.5 py-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">Student Full Name *</label>
                <input
                  type="text"
                  required
                  value={addStudentForm.name}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, name: e.target.value })}
                  placeholder="e.g. Rohan Patil"
                  className="w-full h-8.5 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">PRN (Student ID) *</label>
                <input
                  type="text"
                  required
                  value={addStudentForm.prn}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, prn: e.target.value.toUpperCase() })}
                  placeholder="e.g. F24CE105"
                  className="w-full h-8.5 rounded-md border border-border bg-background px-2.5 text-xs text-foreground uppercase focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">Official PICT Email (@ms.pict.edu) *</label>
              <input
                type="email"
                required
                value={addStudentForm.email}
                onChange={(e) => setAddStudentForm({ ...addStudentForm, email: e.target.value.toLowerCase() })}
                placeholder="e.g. rohan.patil@ms.pict.edu"
                className="w-full h-8.5 rounded-md border border-border bg-background px-2.5 text-xs text-foreground lowercase focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Roll Number</label>
                <input
                  type="text"
                  value={addStudentForm.rollNumber}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, rollNumber: e.target.value })}
                  placeholder="10101"
                  className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Branch</label>
                <select
                  value={addStudentForm.branch}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, branch: e.target.value })}
                  className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                >
                  <option value="CE">CE</option>
                  <option value="IT">IT</option>
                  <option value="ENTC">ENTC</option>
                  <option value="AIDS">AIDS</option>
                  <option value="ECE">ECE</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Year</label>
                <select
                  value={addStudentForm.year}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, year: e.target.value })}
                  className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                >
                  <option value="FY">FY</option>
                  <option value="SY">SY</option>
                  <option value="TY">TY</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Room Number (77 rooms: 101–509)</label>
                <input
                  type="text"
                  value={addStudentForm.doorNumber}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, doorNumber: e.target.value.trim() })}
                  placeholder="e.g. 104"
                  className="w-full h-8.5 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Initial Status</label>
                <select
                  value={addStudentForm.admissionStatus}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, admissionStatus: e.target.value })}
                  className="w-full h-8.5 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                >
                  <option value="APPROVED">Approved (Can log in via OTP immediately)</option>
                  <option value="PENDING_APPROVAL">Pending Approval</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Student Mobile (10 digits)</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={addStudentForm.studentMobile}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, studentMobile: e.target.value })}
                  placeholder="9876543210"
                  className="w-full h-8.5 rounded-md border border-border bg-background px-2.5 text-xs text-foreground font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Parent Mobile (10 digits)</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={addStudentForm.parentMobile}
                  onChange={(e) => setAddStudentForm({ ...addStudentForm, parentMobile: e.target.value })}
                  placeholder="9823000000"
                  className="w-full h-8.5 rounded-md border border-border bg-background px-2.5 text-xs text-foreground font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setAddStudentModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingAdd}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
              >
                {isSubmittingAdd ? <Loader2 className="size-4 animate-spin" /> : "Save & Add Student"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* EDIT STUDENT DETAILS MODAL                                                */}
      {/* ========================================================================= */}
      <Dialog open={editStudentModalOpen} onOpenChange={setEditStudentModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Pencil className="size-4.5 text-blue-600" />
              Edit Student Roster Information
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modify student details while preserving historical records and audit logs.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitEditStudent} className="space-y-3.5 py-1">
            <div className="rounded-lg border border-border bg-muted/20 p-2.5 text-xs space-y-0.5">
              <div className="font-semibold text-foreground">Official Identity (Non-Modifiable)</div>
              <div className="text-muted-foreground font-mono text-[11px]">{editStudentForm.email} | PRN: {editStudentForm.prn}</div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">Student Full Name *</label>
              <input
                type="text"
                required
                value={editStudentForm.name}
                onChange={(e) => setEditStudentForm({ ...editStudentForm, name: e.target.value })}
                className="w-full h-8.5 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Roll Number</label>
                <input
                  type="text"
                  value={editStudentForm.rollNumber}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, rollNumber: e.target.value })}
                  className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Branch</label>
                <select
                  value={editStudentForm.branch}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, branch: e.target.value })}
                  className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                >
                  <option value="CE">CE</option>
                  <option value="IT">IT</option>
                  <option value="ENTC">ENTC</option>
                  <option value="AIDS">AIDS</option>
                  <option value="ECE">ECE</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Year</label>
                <select
                  value={editStudentForm.year}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, year: e.target.value })}
                  className="w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
                >
                  <option value="FY">FY</option>
                  <option value="SY">SY</option>
                  <option value="TY">TY</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Room Number (101–509)</label>
                <input
                  type="text"
                  value={editStudentForm.doorNumber}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, doorNumber: e.target.value.trim() })}
                  placeholder="e.g. 104"
                  className="w-full h-8.5 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Division</label>
                <input
                  type="text"
                  value={editStudentForm.division}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, division: e.target.value })}
                  placeholder="e.g. 1"
                  className="w-full h-8.5 rounded-md border border-border bg-background px-2.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Student Mobile</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={editStudentForm.studentMobile}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, studentMobile: e.target.value })}
                  className="w-full h-8.5 rounded-md border border-border bg-background px-2.5 text-xs text-foreground font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Parent Mobile</label>
                <input
                  type="tel"
                  maxLength={10}
                  value={editStudentForm.parentMobile}
                  onChange={(e) => setEditStudentForm({ ...editStudentForm, parentMobile: e.target.value })}
                  className="w-full h-8.5 rounded-md border border-border bg-background px-2.5 text-xs text-foreground font-mono focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditStudentModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingEdit}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
              >
                {isSubmittingEdit ? <Loader2 className="size-4 animate-spin" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

