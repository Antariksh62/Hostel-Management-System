import React, { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Edit3, Loader2, Lock, Phone, UserCheck } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/hms/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthContext } from "@/context/AuthContext";
import api from "@/services/api";

const BRANCH_OPTIONS = ["CE", "ENTC", "IT", "AIDS", "ECE"];
const YEAR_OPTIONS = ["FY", "SY", "TY"];

export default function StudentProfile() {
  const { t } = useTranslation();
  const { user, updateUser } = useContext(AuthContext);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state for updateable fields ONLY
  const [formData, setFormData] = useState({
    year: "FY",
    mobileNumber: "",
    doorNumber: "",
    rollNumber: "",
    classDiv: "",
    branch: "CE",
  });

  if (!user) return null;

  const handleOpenEdit = () => {
    setFormData({
      year: user.year || "FY",
      mobileNumber: user.mobileNumber || "",
      doorNumber: user.doorNumber || "",
      rollNumber: user.rollNumber || "",
      classDiv: user.classDiv || "",
      branch: user.branch || "CE",
    });
    setIsEditOpen(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    const mobileTrimmed = (formData.mobileNumber || "").trim();
    const mobileRegex = /^[6-9]\d{9}$/;
    if (mobileTrimmed && !mobileRegex.test(mobileTrimmed)) {
      toast.error("Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.");
      return;
    }

    if (!formData.doorNumber.trim()) {
      toast.error("Room number is required.");
      return;
    }

    if (!formData.rollNumber.trim()) {
      toast.error("Roll number is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        year: formData.year,
        mobileNumber: mobileTrimmed,
        doorNumber: formData.doorNumber.trim(),
        rollNumber: formData.rollNumber.trim(),
        classDiv: formData.classDiv.trim(),
        branch: formData.branch,
      };

      const res = await api.patch("/auth/student/update-info", payload);
      const updatedUser = res.data?.user || { ...user, ...payload };
      if (updateUser) {
        updateUser(updatedUser);
      }
      toast.success("Profile details updated successfully!");
      setIsEditOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update profile details.");
    } finally {
      setSaving(false);
    }
  };

  // Profile rows categorized by Locked vs Updatable
  const profileFields = [
    { label: "Full name", value: user.fullName || user.name || "—", updatable: false },
    { label: "College email", value: user.email || "—", updatable: false },
    { label: "PRN", value: user.prn || "—", updatable: false },
    { label: "Joining year", value: user.joiningYear ? String(user.joiningYear) : "—", updatable: false },
    { label: "Academic year", value: user.year || "—", updatable: true },
    { label: "Registered mobile", value: user.mobileNumber || "Not registered", updatable: true, isMono: true },
    { label: "Room number", value: user.doorNumber || "—", updatable: true },
    { label: "Roll number", value: user.rollNumber || "—", updatable: true },
    { label: "Division / Class", value: user.classDiv || "—", updatable: true },
    { label: "Branch", value: user.branch || "—", updatable: true },
  ];

  return (
    <>
      <PageHeader
        title={t("nav.profile", "Student Profile")}
        description="Your verified identity record on file with the hostel office."
        action={
          <Button
            type="button"
            onClick={handleOpenEdit}
            className="flex items-center gap-2 cursor-pointer shadow-xs"
          >
            <Edit3 className="size-4" />
            Update Details
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="bg-muted/40 px-4 py-3 sm:px-6 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Student Identity & Hostel Records
          </span>
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Lock className="size-3 text-muted-foreground/70" />
            Core identity fields are locked
          </span>
        </div>

        <dl className="divide-y divide-border">
          {profileFields.map((field) => (
            <div
              key={field.label}
              className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-6 hover:bg-muted/20 transition-colors"
            >
              <dt className="text-sm text-muted-foreground flex items-center gap-2">
                {field.label}
                {field.updatable ? (
                  <span className="inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    Editable
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Locked
                  </span>
                )}
              </dt>
              <dd className={`truncate text-sm font-medium text-foreground ${field.isMono ? "font-mono" : ""}`}>
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Edit Profile Dialog — Allows ONLY Academic Year, Mobile Number, Room, Roll Number, Division/Class, and Branch */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveProfile}>
            <DialogHeader>
              <div className="flex items-center gap-2 text-primary mb-1">
                <Edit3 className="size-4" />
                <DialogTitle className="text-base">Update Student Profile</DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                You can update your academic year, contact phone number, room, roll number, division/class, and branch. Full name, PRN, and email cannot be changed.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3.5">
              {/* Read-only identity indicator */}
              <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs text-muted-foreground flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="size-4 text-primary" />
                  <span className="font-semibold text-foreground">{user.fullName || user.name}</span>
                  <span className="text-[11px] font-mono">({user.prn})</span>
                </div>
                <span className="text-[11px] flex items-center gap-1 text-muted-foreground">
                  <Lock className="size-3" /> Locked
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 1. Academic Year */}
                <div className="space-y-1">
                  <Label htmlFor="academicYear" className="text-xs font-semibold">
                    Academic Year *
                  </Label>
                  <select
                    id="academicYear"
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {YEAR_OPTIONS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Branch */}
                <div className="space-y-1">
                  <Label htmlFor="branch" className="text-xs font-semibold">
                    Branch *
                  </Label>
                  <select
                    id="branch"
                    value={formData.branch}
                    onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {BRANCH_OPTIONS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 3. Room Number */}
                <div className="space-y-1">
                  <Label htmlFor="doorNumber" className="text-xs font-semibold">
                    Room Number *
                  </Label>
                  <Input
                    id="doorNumber"
                    type="text"
                    required
                    placeholder="e.g. 101"
                    value={formData.doorNumber}
                    onChange={(e) => setFormData({ ...formData, doorNumber: e.target.value })}
                    className="h-10 text-sm"
                  />
                </div>

                {/* 4. Roll Number */}
                <div className="space-y-1">
                  <Label htmlFor="rollNumber" className="text-xs font-semibold">
                    Roll Number *
                  </Label>
                  <Input
                    id="rollNumber"
                    type="text"
                    required
                    placeholder="e.g. 10101"
                    value={formData.rollNumber}
                    onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                    className="h-10 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 5. Division / Class */}
                <div className="space-y-1">
                  <Label htmlFor="classDiv" className="text-xs font-semibold">
                    Division / Class
                  </Label>
                  <Input
                    id="classDiv"
                    type="text"
                    placeholder="e.g. SE-1"
                    value={formData.classDiv}
                    onChange={(e) => setFormData({ ...formData, classDiv: e.target.value })}
                    className="h-10 text-sm"
                  />
                </div>

                {/* 6. Phone Number */}
                <div className="space-y-1">
                  <Label htmlFor="mobileNumber" className="text-xs font-semibold">
                    Phone Number
                  </Label>
                  <Input
                    id="mobileNumber"
                    type="tel"
                    maxLength={10}
                    placeholder="10-digit mobile"
                    value={formData.mobileNumber}
                    onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value.replace(/\D/g, "") })}
                    className="h-10 font-mono text-sm"
                  />
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                Phone number must be an active 10-digit Indian number (starting with 6, 7, 8, or 9).
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditOpen(false)}
                disabled={saving}
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Check className="size-4 mr-1.5" />}
                {t("common.save", "Save Changes")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
