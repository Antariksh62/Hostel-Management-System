import React, { useState, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Droplet, Zap, Wifi, AlertTriangle, Loader2, Users } from "lucide-react";
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
import { AuthContext } from "@/context/AuthContext";
import api from "@/services/api";

const QUICK_SERVICES_CONFIG = [
  {
    quickCategory: "NO_WATER_SUPPLY",
    category: "Plumbing",
    labelKey: "categories.NO_WATER_SUPPLY",
    defaultLabel: "No water supply",
    icon: Droplet,
    colorClass: "text-blue-500 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20",
    title: "No water supply in room",
  },
  {
    quickCategory: "NO_ELECTRICITY",
    category: "Electrical",
    labelKey: "categories.NO_ELECTRICITY",
    defaultLabel: "No electricity",
    icon: Zap,
    colorClass: "text-amber-500 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20",
    title: "No electricity outage in room",
  },
  {
    quickCategory: "WIFI_NOT_WORKING",
    category: "Internet",
    labelKey: "categories.WIFI_NOT_WORKING",
    defaultLabel: "Wi-Fi not working",
    icon: Wifi,
    colorClass: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20",
    title: "Wi-Fi connection problem in room",
  },
];

export default function QuickServiceReporter({ onComplaintSubmitted }) {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const [submitting, setSubmitting] = useState(false);
  const [activeCheckCategory, setActiveCheckCategory] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const quickServices = QUICK_SERVICES_CONFIG.map((s) => ({
    ...s,
    label: t(s.labelKey, s.defaultLabel),
  }));

  const handleQuickClick = async (service) => {
    if (!user?.doorNumber) {
      toast.error("Your room allotment is not registered. Please complete your profile or contact the hostel warden.");
      return;
    }

    setSubmitting(true);
    setActiveCheckCategory(service.quickCategory);

    try {
      // Step 1: Pre-flight duplicate check
      const res = await api.get(
        `/complaints/check-duplicate?category=${encodeURIComponent(service.category)}&quickCategory=${encodeURIComponent(service.quickCategory)}`
      );

      if (res.data?.hasDuplicate && res.data?.existingComplaint) {
        // Open warning/confirmation dialog
        setDuplicateWarning({
          service,
          existing: res.data.existingComplaint,
        });
        setSubmitting(false);
        setActiveCheckCategory(null);
        return;
      }

      // If no duplicate, proceed to submit
      await executeSubmission(service, null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit request.");
    } finally {
      setSubmitting(false);
      setActiveCheckCategory(null);
    }
  };

  const executeSubmission = async (service, parentComplaintId = null) => {
    setSubmitting(true);
    try {
      const payload = {
        title: service.title,
        description: `Predefined quick report for ${service.label} in room ${user?.doorNumber}.`,
        category: service.category,
        quickCategory: service.quickCategory,
        doorNumber: user?.doorNumber,
        parentComplaintId: parentComplaintId || null,
      };

      const res = await api.post("/complaints", payload);
      const created = res.data?.complaint || res.data;

      const ticketRef = created?.complaintId || created?._id?.slice(-6) || "registered";
      if (parentComplaintId) {
        toast.success(`Associated report with active room issue! Ticket #${ticketRef}`);
      } else {
        toast.success(`${service.label} report submitted! Ticket #${ticketRef}`);
      }
      setDuplicateWarning(null);

      if (onComplaintSubmitted) {
        onComplaintSubmitted(created);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Submission failed.");
    } finally {
      setSubmitting(false);
      setActiveCheckCategory(null);
    }
  };

  const isRoommateReport = duplicateWarning && duplicateWarning.existing?.isOwnReport === false;

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-border/60">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            Quick Issue Report
            <span className="text-xs font-normal text-muted-foreground">(Room {user?.doorNumber || "—"})</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            One-click reports for urgent service disruptions. No forms or photos needed.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {quickServices.map((s) => {
          const Icon = s.icon;
          const isCurrentLoading = submitting && activeCheckCategory === s.quickCategory;

          return (
            <button
              key={s.quickCategory}
              type="button"
              disabled={submitting}
              onClick={() => handleQuickClick(s)}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${s.colorClass} disabled:opacity-50`}
            >
              <div className="p-2 rounded-md bg-background/80 shadow-xs shrink-0">
                {isCurrentLoading ? (
                  <Loader2 className="size-4 animate-spin text-foreground" />
                ) : (
                  <Icon className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{s.label}</p>
                <p className="text-[11px] text-muted-foreground">Instant dispatch</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Duplicate / Roommate Confirmation Dialog */}
      <Dialog open={Boolean(duplicateWarning)} onOpenChange={(open) => !open && setDuplicateWarning(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-500 mb-1">
              {isRoommateReport ? <Users className="size-5" /> : <AlertTriangle className="size-5" />}
              <DialogTitle className="text-base">
                {isRoommateReport ? "Roommate Reported Active Issue" : "Active Report Already Exists"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              {isRoommateReport
                ? "A complaint for this service has already been reported for your room. Would you still like to submit your own complaint?"
                : "You already have an active complaint registered for this issue in your room."}
            </DialogDescription>
          </DialogHeader>

          {duplicateWarning && (
            <div className="space-y-3 py-2 text-sm">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 space-y-1.5 text-xs text-foreground">
                <p className="font-semibold text-amber-600 dark:text-amber-400">
                  Existing Ticket #{duplicateWarning.existing.complaintId || duplicateWarning.existing.id?.slice(-6) || duplicateWarning.existing._id?.slice(-6)}
                </p>
                <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                  <div>Status: <span className="font-medium text-foreground">{duplicateWarning.existing.status}</span></div>
                  <div>Reported: <span className="font-medium text-foreground">{new Date(duplicateWarning.existing.createdAt).toLocaleDateString()} {new Date(duplicateWarning.existing.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {isRoommateReport
                  ? "Confirming associates your report with the existing room issue while preserving your personal record and notification history."
                  : "If the problem is persisting or worse, you can still submit a new separate ticket. Each submission is tracked independently."}
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {isRoommateReport ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDuplicateWarning(null)}
                  disabled={submitting}
                >
                  No, go back
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={submitting}
                  onClick={() => {
                    if (duplicateWarning?.service) {
                      executeSubmission(duplicateWarning.service, null);
                    }
                  }}
                >
                  Report different issue
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={submitting}
                  onClick={() => {
                    if (duplicateWarning?.service) {
                      executeSubmission(duplicateWarning.service, duplicateWarning.existing.id);
                    }
                  }}
                >
                  {submitting ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : null}
                  Yes, submit my complaint
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDuplicateWarning(null)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="default"
                  disabled={submitting}
                  onClick={() => {
                    if (duplicateWarning?.service) {
                      executeSubmission(duplicateWarning.service, null);
                    }
                  }}
                >
                  {submitting ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : null}
                  Proceed With New Report
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
