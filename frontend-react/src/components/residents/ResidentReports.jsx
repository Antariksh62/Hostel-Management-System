import React, { useContext, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2,
  Building,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  Loader2,
  ShieldCheck,
  Users
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AuthContext } from "@/context/AuthContext";
import api from "@/services/api";

const BRANCHES = ["CE", "ENTC", "IT", "AIDS", "ECE"];
const YEARS = ["FY", "SY", "TY"];

export default function ResidentReports() {
  const { user } = useContext(AuthContext);
  const isHeadWarden = user?.role === "HEADWARDEN";

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Export filters
  const [exportFilters, setExportFilters] = useState({
    floor: "",
    branch: "",
    year: "",
    roomStatus: "",
    profileStatus: "",
  });

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["residents-reports"],
    queryFn: () => api.get("/residents/reports").then((r) => r.data),
  });

  const overview = reportData?.overview || {};
  const floorDist = reportData?.floorDistribution || {};
  const branchDist = reportData?.branchDistribution || {};
  const yearDist = reportData?.yearDistribution || {};
  const divisionDist = reportData?.divisionDistribution || {};

  // Download sanitized CSV (HEADWARDEN exclusive)
  const handleDownloadCSV = async () => {
    if (!isHeadWarden) {
      toast.error("Access denied: Exclusive Head Warden permission required for CSV export.");
      return;
    }
    try {
      setIsExporting(true);
      const params = new URLSearchParams();
      if (exportFilters.floor) params.append("floor", exportFilters.floor);
      if (exportFilters.branch) params.append("branch", exportFilters.branch);
      if (exportFilters.year) params.append("year", exportFilters.year);
      if (exportFilters.roomStatus) params.append("roomStatus", exportFilters.roomStatus);
      if (exportFilters.profileStatus) params.append("profileStatus", exportFilters.profileStatus);

      const res = await api.get(`/residents/export?${params.toString()}`, {
        responseType: "blob",
      });

      // Trigger browser file download
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `hostel_residents_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Resident records exported successfully. Security audit logged.");
      setIsExportModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to export resident CSV");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner with Export Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <BarChart2 className="size-4 text-primary" />
            Resident Demographics & Occupancy Reports
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Aggregated statistics derived from verified database records.
          </p>
        </div>

        {isHeadWarden && (
          <Button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Download className="size-4" />
            Export Resident CSV
          </Button>
        )}
      </div>

      {/* High-level Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs text-muted-foreground">Total Registered Residents</span>
          <p className="text-2xl font-bold text-foreground mt-1">{overview.totalResidents || 0}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Active hostel students</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs text-muted-foreground">Assigned to Rooms</span>
          <p className="text-2xl font-bold text-emerald-500 mt-1">{overview.assignedCount || 0}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{overview.unassignedCount || 0} unassigned</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs text-muted-foreground">Complete Profiles</span>
          <p className="text-2xl font-bold text-primary mt-1">{overview.profileCompleteCount || 0}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{overview.profileIncompleteCount || 0} incomplete</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <span className="text-xs text-muted-foreground">Empty Rooms</span>
          <p className="text-2xl font-bold text-amber-500 mt-1">{overview.emptyRoomsCount || 0}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Out of 77 authoritative rooms</p>
        </div>
      </div>

      {/* Distributions Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Floor Distribution */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Building className="size-4 text-primary" />
            Floor-wise Resident Distribution
          </h4>
          <div className="space-y-2.5 pt-1">
            {[1, 2, 3, 4, 5].map((fl) => {
              const count = floorDist[fl] || 0;
              const maxFloor = overview.totalResidents || 1;
              const pct = Math.round((count / maxFloor) * 100);
              return (
                <div key={fl} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-foreground">Floor {fl}</span>
                    <span className="text-muted-foreground">{count} residents ({pct}%)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Academic Year Distribution */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <GraduationCap className="size-4 text-primary" />
            Academic Year Distribution
          </h4>
          <div className="space-y-2.5 pt-1">
            {["FY", "SY", "TY"].map((yr) => {
              const count = yearDist[yr] || 0;
              const maxYear = overview.totalResidents || 1;
              const pct = Math.round((count / maxYear) * 100);
              return (
                <div key={yr} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-foreground">{yr} (Year {yr === "FY" ? 1 : yr === "SY" ? 2 : 3})</span>
                    <span className="text-muted-foreground">{count} students ({pct}%)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Branch Distribution */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Layers className="size-4 text-primary" />
            Branch Breakdown
          </h4>
          <div className="grid grid-cols-2 gap-3 pt-1">
            {BRANCHES.map((br) => {
              const count = branchDist[br] || 0;
              return (
                <div key={br} className="rounded-lg border border-border/70 bg-surface/30 p-3 text-xs">
                  <span className="text-muted-foreground">{br}</span>
                  <p className="text-lg font-bold text-foreground mt-0.5">{count}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Division Distribution */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Users className="size-4 text-primary" />
            Class / Division Breakdown
          </h4>
          {Object.keys(divisionDist).length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-4">No division data recorded</p>
          ) : (
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {Object.entries(divisionDist).map(([div, cnt]) => (
                <div key={div} className="rounded-lg border border-border/70 bg-surface/30 p-2.5 text-center text-xs">
                  <span className="font-medium text-foreground">{div}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{cnt} students</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Export to CSV Modal */}
      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary mb-1">
              <FileSpreadsheet className="size-5" />
              <DialogTitle className="text-base">Export Resident Directory to CSV</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Download sanitized resident records. Security protections against spreadsheet formula injection are automatically applied.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3 text-xs">
            <div className="space-y-1">
              <Label htmlFor="expFloor" className="text-xs font-semibold">Floor Filter</Label>
              <select
                id="expFloor"
                value={exportFilters.floor}
                onChange={(e) => setExportFilters({ ...exportFilters, floor: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">All Floors</option>
                <option value="1">Floor 1 (Rooms 101–117)</option>
                <option value="2">Floor 2 (Rooms 201–217)</option>
                <option value="3">Floor 3 (Rooms 301–317)</option>
                <option value="4">Floor 4 (Rooms 401–417)</option>
                <option value="5">Floor 5 (Rooms 501–509)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="expBranch" className="text-xs font-semibold">Branch</Label>
                <select
                  id="expBranch"
                  value={exportFilters.branch}
                  onChange={(e) => setExportFilters({ ...exportFilters, branch: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">All Branches</option>
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="expYear" className="text-xs font-semibold">Year</Label>
                <select
                  id="expYear"
                  value={exportFilters.year}
                  onChange={(e) => setExportFilters({ ...exportFilters, year: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">All Years</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="expRoomStatus" className="text-xs font-semibold">Room Assignment</Label>
                <select
                  id="expRoomStatus"
                  value={exportFilters.roomStatus}
                  onChange={(e) => setExportFilters({ ...exportFilters, roomStatus: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">All Records</option>
                  <option value="assigned">Assigned Only</option>
                  <option value="unassigned">Unassigned Only</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="expProfileStatus" className="text-xs font-semibold">Profile Status</Label>
                <select
                  id="expProfileStatus"
                  value={exportFilters.profileStatus}
                  onChange={(e) => setExportFilters({ ...exportFilters, profileStatus: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">All Profiles</option>
                  <option value="complete">Complete Only</option>
                  <option value="incomplete">Incomplete Only</option>
                </select>
              </div>
            </div>

            {/* Privacy notice */}
            <div className="rounded-lg border border-border/80 bg-muted/30 p-2.5 text-[11px] text-muted-foreground space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <ShieldCheck className="size-3.5 text-primary" />
                Data Privacy Guarantee
              </div>
              <p>
                Student mobile numbers, parent/guardian phone numbers, and private complaint histories are excluded from exports by default to protect resident privacy.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isExporting}
              onClick={() => setIsExportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isExporting}
              onClick={handleDownloadCSV}
              className="cursor-pointer"
            >
              {isExporting ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Download className="size-4 mr-1.5" />}
              Generate & Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

