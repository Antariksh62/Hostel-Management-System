import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
  Upload,
  User,
  X
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import api from "@/services/api";

export default function ResidentImport() {
  const queryClient = useQueryClient();

  const [csvFile, setCsvFile] = useState(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Preview data state
  const [previewData, setPreviewData] = useState(null);
  const [importResult, setImportResult] = useState(null);

  // Client-side CSV parser (supports UTF-8 with and without BOM)
  const parseCSVText = (text) => {
    const cleanText = text.replace(/^\uFEFF/, "");
    const lines = cleanText.split(/\r\n|\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, "").replace(/^\uFEFF/, ""));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const currentLine = lines[i];
      const values = [];
      let inQuotes = false;
      let currentVal = "";

      for (let c = 0; c < currentLine.length; c++) {
        const char = currentLine[c];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          values.push(currentVal.trim());
          currentVal = "";
        } else {
          currentVal += char;
        }
      }
      values.push(currentVal.trim());

      const rowObj = {};
      headers.forEach((h, idx) => {
        rowObj[h] = values[idx] ? values[idx].replace(/^["']|["']$/g, "") : "";
      });
      rows.push(rowObj);
    }
    return rows;
  };

  // Handle file select and preview upload
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a valid .csv file");
      return;
    }

    setCsvFile(file);
    setImportResult(null);
    setIsParsing(true);

    try {
      const text = await file.text();
      const parsedRows = parseCSVText(text);

      if (parsedRows.length === 0) {
        toast.error("The selected CSV file appears to be empty.");
        setIsParsing(false);
        return;
      }

      // Send to server for dry-run preview matching
      const res = await api.post("/residents/import-preview", { rows: parsedRows });
      setPreviewData(res.data);
      toast.success(`Preview generated for ${parsedRows.length} records. Review changes below.`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to parse CSV preview");
    } finally {
      setIsParsing(false);
    }
  };

  // Confirm and apply import
  const handleConfirmImport = async () => {
    if (!previewData || !previewData.records) return;

    const validRecords = previewData.records.filter((r) => r.isValid);
    if (validRecords.length === 0) {
      toast.error("No valid records to import.");
      return;
    }

    setIsConfirming(true);
    try {
      const res = await api.post("/residents/import-confirm", {
        records: validRecords,
        idempotencyKey: previewData.previewId,
      });

      setImportResult(res.data);
      toast.success(`Bulk import completed: ${res.data.appliedCount} residents updated.`);

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["residents-directory"] });
      queryClient.invalidateQueries({ queryKey: ["residents-occupancy"] });
      queryClient.invalidateQueries({ queryKey: ["residents-reports"] });

      // Clear preview
      setPreviewData(null);
      setCsvFile(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to apply bulk import");
    } finally {
      setIsConfirming(false);
    }
  };

  // Reset / Cancel preview
  const handleCancelPreview = () => {
    setPreviewData(null);
    setCsvFile(null);
    setImportResult(null);
  };

  // Download authoritative CSV template from backend
  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get("/residents/import-template", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "resident_import_template.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Authoritative template downloaded");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to download template");
    }
  };

  return (
    <div className="space-y-6">
      {/* Information & Template Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Upload className="size-4 text-primary" />
            Bulk Resident Record Import
            <Badge variant="outline" className="border-primary/40 text-primary text-[10px] font-mono">
              Head Warden Exclusive
            </Badge>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Imports student records using PRN, Branch, Room, Parent Contact Number, and Student Contact Number.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadTemplate}
          className="flex items-center gap-1.5 cursor-pointer text-xs self-start sm:self-center"
        >
          <Download className="size-3.5" />
          Download CSV Template
        </Button>
      </div>

      {/* Upload Box (Visible when no preview is loaded) */}
      {!previewData && !importResult && (
        <div className="rounded-xl border-2 border-dashed border-border p-8 text-center bg-card/40 hover:bg-card/70 transition-colors">
          <input
            id="csvUploadInput"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <label htmlFor="csvUploadInput" className="cursor-pointer flex flex-col items-center justify-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
              <FileUp className="size-6" />
            </div>
            <p className="font-semibold text-sm text-foreground">Click to select or drop a resident CSV file</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Required 5 columns: <span className="font-mono text-foreground font-semibold">PRN, Branch, Room, Parent Contact Number, Student Contact Number</span>. All fields are mandatory.
            </p>
            <Button size="sm" className="mt-4 pointer-events-none" disabled={isParsing}>
              {isParsing ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Upload className="size-4 mr-1.5" />}
              Choose CSV File
            </Button>
          </label>
        </div>
      )}

      {/* Import Result Banner */}
      {importResult && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 space-y-3">
          <div className="flex items-center gap-2.5 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-5" />
            <h4 className="font-bold text-sm">Bulk Import Applied Successfully</h4>
          </div>
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            Updated {importResult.appliedCount} resident records. All room reassignments have been logged to each student's room history timeline.
          </p>
          <Button size="sm" variant="outline" onClick={handleCancelPreview} className="text-xs">
            Import Another File
          </Button>
        </div>
      )}

      {/* Dry-Run Preview Table & Action Controls */}
      {previewData && (
        <div className="space-y-4">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <span className="text-xs text-muted-foreground">Total Rows in CSV</span>
              <p className="text-lg font-bold text-foreground mt-0.5">{previewData.summary.totalRows}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <span className="text-xs text-muted-foreground">Valid Records</span>
              <p className="text-lg font-bold text-emerald-500 mt-0.5">{previewData.summary.validRows}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <span className="text-xs text-muted-foreground">Room Changes</span>
              <p className="text-lg font-bold text-primary mt-0.5">{previewData.summary.roomChangesCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3 text-center">
              <span className="text-xs text-muted-foreground">Invalid / Errors</span>
              <p className={`text-lg font-bold mt-0.5 ${previewData.summary.errorCount > 0 ? "text-rose-500" : "text-muted-foreground"}`}>
                {previewData.summary.errorCount}
              </p>
            </div>
          </div>

          {/* Room Over Capacity Conflict Banner */}
          {previewData.summary.overCapacityRoomsCount > 0 && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-2 text-rose-600 dark:text-rose-400 text-xs">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertCircle className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>Room Capacity Conflict Detected</span>
              </div>
              <p>
                The uploaded CSV would cause {previewData.summary.overCapacityRoomsCount} room(s) to exceed the maximum capacity limit of {previewData.summary.maxStudentsPerRoom || 2} students. Conflicting assignments are highlighted in red below. Please correct the CSV and generate a new preview.
              </p>
              {previewData.roomProjections?.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {previewData.roomProjections.map((p) => (
                    <Badge key={p.roomNumber} variant="destructive" className="text-[11px] font-mono">
                      Room {p.roomNumber}: Current {p.existingOccupancy} (+{p.proposedAdditions}/-{p.proposedRemovals}) → Projected {p.projectedOccupancy} (Max {p.maxCapacity})
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Safety Notice */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-primary flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <ShieldAlert className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Dry-Run Preview Active</p>
                <p className="text-[11px] opacity-90 mt-0.5">
                  No database modifications have taken place. Review the field differences below before clicking Confirm.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={handleCancelPreview} disabled={isConfirming} className="h-8 text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmImport}
                disabled={isConfirming || previewData.summary.validRows === 0 || previewData.summary.overCapacityRoomsCount > 0}
                className="h-8 text-xs cursor-pointer"
              >
                {isConfirming ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="size-3.5 mr-1.5" />}
                Confirm & Apply ({previewData.summary.validRows})
              </Button>
            </div>
          </div>

          {/* Records Preview Table */}
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="sticky top-0 border-b border-border bg-muted/80 backdrop-blur-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-3 py-2.5">Row</th>
                    <th className="px-3 py-2.5">PRN & Student</th>
                    <th className="px-3 py-2.5">Branch</th>
                    <th className="px-3 py-2.5">Room</th>
                    <th className="px-3 py-2.5">Parent Contact</th>
                    <th className="px-3 py-2.5">Student Contact</th>
                    <th className="px-3 py-2.5">Status & Validation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {previewData.records.map((r) => (
                    <tr key={r.rowIndex} className={r.isValid ? "hover:bg-muted/30" : "bg-rose-500/5 hover:bg-rose-500/10"}>
                      <td className="px-3 py-2 text-muted-foreground font-mono">{r.rowIndex}</td>
                      <td className="px-3 py-2">
                        <p className="font-mono font-bold text-foreground">{r.prn}</p>
                        <p className="text-[11px] text-muted-foreground">{r.studentName}</p>
                      </td>

                      {/* Branch */}
                      <td className="px-3 py-2">
                        {r.hasBranchChange ? (
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground line-through text-[11px]">{r.currentBranch}</span>
                            <ArrowRight className="size-3 text-primary" />
                            <Badge variant="outline" className="font-bold border-primary/40 text-primary">
                              {r.newBranch}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{r.newBranch || "—"}</span>
                        )}
                      </td>

                      {/* Room */}
                      <td className="px-3 py-2">
                        {r.hasRoomChange ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground line-through text-[11px]">{r.currentRoom}</span>
                            <ArrowRight className="size-3 text-primary" />
                            <Badge className="bg-primary text-primary-foreground font-bold">
                              Room {r.newRoom}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Room {r.newRoom || "Unassigned"}</span>
                        )}
                      </td>

                      {/* Parent Phone */}
                      <td className="px-3 py-2">
                        {r.hasParentPhoneChange ? (
                          <div className="space-y-0.5">
                            <span className="text-muted-foreground line-through text-[11px] block">{r.currentParentPhoneMasked}</span>
                            <span className="text-foreground font-mono font-medium block">{r.newParentPhoneMasked}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground font-mono">{r.newParentPhoneMasked || "—"}</span>
                        )}
                      </td>

                      {/* Student Phone */}
                      <td className="px-3 py-2">
                        {r.hasStudentPhoneChange ? (
                          <div className="space-y-0.5">
                            <span className="text-muted-foreground line-through text-[11px] block">{r.currentStudentPhoneMasked}</span>
                            <span className="text-foreground font-mono font-medium block">{r.newStudentPhoneMasked}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground font-mono">{r.newStudentPhoneMasked || "—"}</span>
                        )}
                      </td>

                      {/* Validation */}
                      <td className="px-3 py-2">
                        {r.isValid ? (
                          <span className="inline-flex items-center text-emerald-500 font-medium">
                            <CheckCircle2 className="size-3.5 mr-1" />
                            Ready to apply
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            {r.errors.map((err, ei) => (
                              <p key={ei} className="text-rose-500 font-medium flex items-center gap-1">
                                <AlertCircle className="size-3 shrink-0" />
                                <span>{err}</span>
                              </p>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
