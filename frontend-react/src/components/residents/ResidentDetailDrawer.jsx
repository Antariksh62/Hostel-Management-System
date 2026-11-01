import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Building,
  Calendar,
  Check,
  Clock,
  DoorOpen,
  Edit2,
  Eye,
  History,
  Lock,
  MessageSquare,
  Phone,
  Shield,
  ShieldCheck,
  User,
  Users,
  X
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import api from "@/services/api";

const ALL_77_ROOMS = [
  ...Array.from({ length: 17 }, (_, i) => String(101 + i)),
  ...Array.from({ length: 17 }, (_, i) => String(201 + i)),
  ...Array.from({ length: 17 }, (_, i) => String(301 + i)),
  ...Array.from({ length: 17 }, (_, i) => String(401 + i)),
  ...Array.from({ length: 9 }, (_, i) => String(501 + i)),
];

export default function ResidentDetailDrawer({
  residentId,
  isOpen,
  onClose,
}) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");

  // Contact unmasking state
  const [unmaskedContacts, setUnmaskedContacts] = useState(null);
  const [isRevealing, setIsRevealing] = useState(false);

  // Edit contacts dialog state
  const [isEditContactsOpen, setIsEditContactsOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    guardianName: "",
    guardianRelationship: "",
    guardianPhone: "",
    guardianSecondaryPhone: "",
    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone: "",
    emergencySecondaryPhone: "",
  });

  // Reassign room dialog state
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [reassignForm, setReassignForm] = useState({
    newRoom: "",
    reason: "",
  });

  // Fetch student details
  const { data: resident, isLoading } = useQuery({
    queryKey: ["resident-detail", residentId],
    queryFn: () => api.get(`/residents/${residentId}`).then((r) => r.data),
    enabled: Boolean(isOpen && residentId),
  });

  // Fetch student authorized complaints (strictly Wi-Fi isolated)
  const { data: complaintData } = useQuery({
    queryKey: ["resident-complaints", residentId],
    queryFn: () => api.get(`/residents/${residentId}/complaints`).then((r) => r.data),
    enabled: Boolean(isOpen && residentId),
  });

  // Handler to reveal contact numbers on-demand (with backend audit log)
  const handleRevealContacts = async () => {
    try {
      setIsRevealing(true);
      const res = await api.post(`/residents/${residentId}/reveal-contact`);
      setUnmaskedContacts(res.data);
      toast.success("Contact information revealed. Access logged.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reveal contact numbers");
    } finally {
      setIsRevealing(false);
    }
  };

  // Open edit contacts modal pre-filled
  const handleOpenEditContacts = () => {
    setContactForm({
      guardianName: resident?.guardianName || "",
      guardianRelationship: resident?.guardianRelationship || "",
      guardianPhone: unmaskedContacts?.guardianPhone || "",
      guardianSecondaryPhone: unmaskedContacts?.guardianSecondaryPhone || "",
      emergencyName: resident?.emergencyName || "",
      emergencyRelationship: resident?.emergencyRelationship || "",
      emergencyPhone: unmaskedContacts?.emergencyPhone || "",
      emergencySecondaryPhone: unmaskedContacts?.emergencySecondaryPhone || "",
    });
    setIsEditContactsOpen(true);
  };

  // Save admin-managed contacts
  const handleSaveContacts = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/residents/${residentId}/contacts`, contactForm);
      toast.success("Emergency and guardian contacts updated successfully.");
      queryClient.invalidateQueries({ queryKey: ["resident-detail", residentId] });
      // Update local unmasked cache
      setUnmaskedContacts((prev) => ({
        ...prev,
        ...contactForm,
      }));
      setIsEditContactsOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update contact records");
    }
  };

  // Open reassign room modal
  const handleOpenReassign = () => {
    setReassignForm({
      newRoom: resident?.doorNumber || "",
      reason: "",
    });
    setIsReassignOpen(true);
  };

  // Save room reassignment
  const handleSaveReassign = async (e) => {
    e.preventDefault();
    if (!reassignForm.newRoom) {
      toast.error("Please select a valid room number");
      return;
    }
    try {
      await api.patch(`/residents/${residentId}/room`, reassignForm);
      toast.success(`Resident reassigned to Room ${reassignForm.newRoom}`);
      queryClient.invalidateQueries({ queryKey: ["resident-detail", residentId] });
      queryClient.invalidateQueries({ queryKey: ["residents-directory"] });
      queryClient.invalidateQueries({ queryKey: ["residents-occupancy"] });
      setIsReassignOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reassign room");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="flex h-full w-full max-w-full sm:max-w-2xl flex-col border-l border-border bg-card shadow-2xl">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
              {resident?.fullName?.[0] || resident?.name?.[0] || "S"}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-foreground">
                {resident?.fullName || resident?.name || "Loading Resident..."}
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{resident?.prn || "PRN"}</span>
                <span>•</span>
                <span>Roll: {resident?.rollNumber || "—"}</span>
                <span>•</span>
                <span>Room: {resident?.doorNumber ? `${resident.doorNumber} (F${resident.floor})` : "Unassigned"}</span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-8 rounded-full text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Drawer Body with Tabs */}
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Clock className="size-6 animate-spin mr-2" /> Loading details...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6 text-xs">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="room">Room</TabsTrigger>
                <TabsTrigger value="complaints">Complaints</TabsTrigger>
                <TabsTrigger value="contacts">Contacts</TabsTrigger>
              </TabsList>

              {/* ────────────────── 1. PROFILE TAB ────────────────── */}
              <TabsContent value="profile" className="space-y-6">
                <div className="rounded-xl border border-border bg-surface/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Verified Identity Record
                    </span>
                    <Badge variant={resident?.profileComplete ? "default" : "secondary"}>
                      {resident?.profileComplete ? "Profile Complete" : "Profile Incomplete"}
                    </Badge>
                  </div>

                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Official College Email</dt>
                      <dd className="font-mono font-medium text-foreground flex items-center gap-1.5 mt-0.5">
                        <Lock className="size-3 text-muted-foreground/80" />
                        {resident?.email || "—"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-muted-foreground">PRN</dt>
                      <dd className="font-mono font-medium text-foreground mt-0.5">{resident?.prn || "—"}</dd>
                    </div>

                    <div>
                      <dt className="text-xs text-muted-foreground">Roll Number</dt>
                      <dd className="font-medium text-foreground mt-0.5">{resident?.rollNumber || "—"}</dd>
                    </div>

                    <div>
                      <dt className="text-xs text-muted-foreground">Branch & Year</dt>
                      <dd className="font-medium text-foreground mt-0.5">
                        {resident?.branch || "—"} • {resident?.year || "—"}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-xs text-muted-foreground">Division / Class</dt>
                      <dd className="font-medium text-foreground mt-0.5">{resident?.classDiv || "—"}</dd>
                    </div>

                    <div>
                      <dt className="text-xs text-muted-foreground">Joining Year</dt>
                      <dd className="font-medium text-foreground mt-0.5">{resident?.joiningYear || "—"}</dd>
                    </div>
                  </dl>
                </div>

                {/* Student Personal Mobile */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="size-4 text-primary" />
                      <span className="text-sm font-semibold">Student Contact Mobile</span>
                    </div>
                    {!unmaskedContacts && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRevealContacts}
                        disabled={isRevealing}
                        className="h-8 text-xs cursor-pointer"
                      >
                        <Eye className="size-3.5 mr-1" />
                        Reveal Contact
                      </Button>
                    )}
                  </div>
                  <p className="font-mono text-sm font-medium">
                    {unmaskedContacts?.mobileNumber || resident?.mobileNumberMasked || "Not registered"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Direct personal number registered during student onboarding. Protected under hostel privacy policy.
                  </p>
                </div>
              </TabsContent>

              {/* ────────────────── 2. ROOM TAB ────────────────── */}
              <TabsContent value="room" className="space-y-6">
                <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
                  <div>
                    <span className="text-xs text-muted-foreground">Current Room Assignment</span>
                    <h3 className="text-xl font-bold text-foreground mt-0.5">
                      {resident?.doorNumber ? `Room ${resident.doorNumber}` : "Unassigned"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {resident?.doorNumber ? `Floor ${resident.floor} • Boys' Hostel 77-Room Inventory` : "Needs Room Allotment"}
                    </p>
                  </div>
                  <Button onClick={handleOpenReassign} variant="default" size="sm" className="cursor-pointer">
                    <DoorOpen className="size-4 mr-1.5" />
                    Reassign Room
                  </Button>
                </div>

                {/* Room Movement History */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <History className="size-3.5" />
                    Room Assignment History
                  </h4>

                  {(!resident?.roomHistory || resident.roomHistory.length === 0) ? (
                    <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
                      No room movement history recorded yet for this resident.
                    </div>
                  ) : (
                    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                      {resident.roomHistory.map((h, i) => (
                        <div key={i} className="flex items-center justify-between p-3.5 text-xs">
                          <div>
                            <p className="font-semibold text-foreground">
                              {h.previousRoom} → {h.newRoom}
                            </p>
                            <p className="text-muted-foreground mt-0.5">{h.reason || "Room transfer"}</p>
                          </div>
                          <div className="text-right text-muted-foreground">
                            <p>{h.changedBy}</p>
                            <p className="text-[10px] mt-0.5">
                              {h.changedAt ? new Date(h.changedAt).toLocaleDateString() : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ────────────────── 3. COMPLAINTS TAB (WI-FI ISOLATED) ────────────────── */}
              <TabsContent value="complaints" className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-border bg-card p-3 text-center">
                    <span className="text-xs text-muted-foreground">Total Complaints</span>
                    <p className="text-xl font-bold text-foreground mt-1">{complaintData?.summary?.total || 0}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3 text-center">
                    <span className="text-xs text-muted-foreground">Currently Active</span>
                    <p className="text-xl font-bold text-amber-500 mt-1">{complaintData?.summary?.activeCount || 0}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-3 text-center">
                    <span className="text-xs text-muted-foreground">Resolved</span>
                    <p className="text-xl font-bold text-emerald-500 mt-1">{complaintData?.summary?.resolvedCount || 0}</p>
                  </div>
                </div>

                {/* Current Active Complaints */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Active Complaints ({complaintData?.currentComplaints?.length || 0})
                  </h4>
                  {complaintData?.currentComplaints?.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No active maintenance complaints.</p>
                  ) : (
                    <div className="space-y-2">
                      {complaintData?.currentComplaints?.map((c) => (
                        <div key={c._id} className="rounded-lg border border-border bg-card p-3.5 text-xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">{c.title || c.category}</span>
                            <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                          </div>
                          <p className="text-muted-foreground">{c.description || "No description provided"}</p>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                            <span>Room {c.doorNumber || "—"}</span>
                            <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Resolved History */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Previously Resolved Complaints ({complaintData?.previousComplaints?.length || 0})
                  </h4>
                  {complaintData?.previousComplaints?.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No resolved complaint history.</p>
                  ) : (
                    <div className="space-y-2">
                      {complaintData?.previousComplaints?.map((c) => (
                        <div key={c._id} className="rounded-lg border border-border bg-card/60 p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground">{c.title || c.category}</span>
                            <Badge variant="secondary" className="text-[10px]">Resolved</Badge>
                          </div>
                          <p className="text-muted-foreground text-[11px]">{c.description || "Resolved by maintenance"}</p>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>Assigned: {c.assignedTo?.name || "General Maintenance"}</span>
                            <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ────────────────── 4. CONTACTS TAB (ADMIN-MANAGED) ────────────────── */}
              <TabsContent value="contacts" className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Parent & Emergency Contacts
                  </span>
                  <div className="flex items-center gap-2">
                    {!unmaskedContacts && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRevealContacts}
                        disabled={isRevealing}
                        className="h-8 text-xs cursor-pointer"
                      >
                        <Eye className="size-3.5 mr-1" />
                        Reveal Numbers
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={handleOpenEditContacts}
                      className="h-8 text-xs cursor-pointer"
                    >
                      <Edit2 className="size-3.5 mr-1" />
                      Edit Contacts
                    </Button>
                  </div>
                </div>

                {/* Parent / Guardian Card */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2 text-primary">
                    <Users className="size-4" />
                    <span className="text-sm font-semibold text-foreground">Parent / Guardian Contact</span>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Guardian Name</dt>
                      <dd className="font-semibold text-foreground mt-0.5">{resident?.guardianName || "Not on file"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Relationship</dt>
                      <dd className="font-medium text-foreground mt-0.5">{resident?.guardianRelationship || "Not specified"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Primary Mobile</dt>
                      <dd className="font-mono font-medium text-foreground mt-0.5">
                        {unmaskedContacts?.guardianPhone || resident?.guardianPhoneMasked || "Not registered"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Secondary Mobile</dt>
                      <dd className="font-mono font-medium text-foreground mt-0.5">
                        {unmaskedContacts?.guardianSecondaryPhone || resident?.guardianSecondaryPhoneMasked || "—"}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Emergency Contact Card */}
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2 text-rose-500">
                    <Shield className="size-4" />
                    <span className="text-sm font-semibold text-foreground">Designated Emergency Contact</span>
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Contact Person</dt>
                      <dd className="font-semibold text-foreground mt-0.5">{resident?.emergencyName || "Not on file"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Relationship</dt>
                      <dd className="font-medium text-foreground mt-0.5">{resident?.emergencyRelationship || "Not specified"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Emergency Mobile</dt>
                      <dd className="font-mono font-medium text-rose-500 mt-0.5">
                        {unmaskedContacts?.emergencyPhone || resident?.emergencyPhoneMasked || "Not registered"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Secondary Emergency Phone</dt>
                      <dd className="font-mono font-medium text-foreground mt-0.5">
                        {unmaskedContacts?.emergencySecondaryPhone || resident?.emergencySecondaryPhoneMasked || "—"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Edit Contacts Dialog */}
      <Dialog open={isEditContactsOpen} onOpenChange={setIsEditContactsOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveContacts}>
            <DialogHeader>
              <DialogTitle className="text-base">Edit Parent & Emergency Contacts</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Administrative contact update for {resident?.fullName}. All updates are recorded in the security audit log.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4 text-xs">
              <h4 className="font-semibold text-foreground border-b border-border pb-1">Parent / Guardian Information</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="gName" className="text-xs">Guardian Name</Label>
                  <Input
                    id="gName"
                    value={contactForm.guardianName}
                    onChange={(e) => setContactForm({ ...contactForm, guardianName: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="gRel" className="text-xs">Relationship</Label>
                  <Input
                    id="gRel"
                    placeholder="Father / Mother"
                    value={contactForm.guardianRelationship}
                    onChange={(e) => setContactForm({ ...contactForm, guardianRelationship: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="gPhone" className="text-xs">Primary Mobile</Label>
                  <Input
                    id="gPhone"
                    maxLength={10}
                    placeholder="10 digits"
                    value={contactForm.guardianPhone}
                    onChange={(e) => setContactForm({ ...contactForm, guardianPhone: e.target.value.replace(/\D/g, "") })}
                    className="h-9 font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="gSecPhone" className="text-xs">Secondary Mobile</Label>
                  <Input
                    id="gSecPhone"
                    maxLength={10}
                    placeholder="Optional"
                    value={contactForm.guardianSecondaryPhone}
                    onChange={(e) => setContactForm({ ...contactForm, guardianSecondaryPhone: e.target.value.replace(/\D/g, "") })}
                    className="h-9 font-mono text-xs"
                  />
                </div>
              </div>

              <h4 className="font-semibold text-foreground border-b border-border pb-1 pt-2">Emergency Contact Information</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="eName" className="text-xs">Contact Name</Label>
                  <Input
                    id="eName"
                    value={contactForm.emergencyName}
                    onChange={(e) => setContactForm({ ...contactForm, emergencyName: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="eRel" className="text-xs">Relationship</Label>
                  <Input
                    id="eRel"
                    placeholder="Brother / Local Guardian"
                    value={contactForm.emergencyRelationship}
                    onChange={(e) => setContactForm({ ...contactForm, emergencyRelationship: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="ePhone" className="text-xs">Emergency Mobile</Label>
                  <Input
                    id="ePhone"
                    maxLength={10}
                    placeholder="10 digits"
                    value={contactForm.emergencyPhone}
                    onChange={(e) => setContactForm({ ...contactForm, emergencyPhone: e.target.value.replace(/\D/g, "") })}
                    className="h-9 font-mono text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="eSecPhone" className="text-xs">Secondary Phone</Label>
                  <Input
                    id="eSecPhone"
                    maxLength={10}
                    placeholder="Optional"
                    value={contactForm.emergencySecondaryPhone}
                    onChange={(e) => setContactForm({ ...contactForm, emergencySecondaryPhone: e.target.value.replace(/\D/g, "") })}
                    className="h-9 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditContactsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">Save Contacts</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reassign Room Dialog */}
      <Dialog open={isReassignOpen} onOpenChange={setIsReassignOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={handleSaveReassign}>
            <DialogHeader>
              <DialogTitle className="text-base">Reassign Resident Room</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Move {resident?.fullName} to another hostel room. This will be recorded in room assignment history.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="targetRoom" className="text-xs font-semibold">Select New Room (101–509)</Label>
                <select
                  id="targetRoom"
                  value={reassignForm.newRoom}
                  onChange={(e) => setReassignForm({ ...reassignForm, newRoom: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select Room</option>
                  {ALL_77_ROOMS.map((r) => (
                    <option key={r} value={r}>Room {r}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="reassignReason" className="text-xs font-semibold">Reason for Reassignment</Label>
                <Input
                  id="reassignReason"
                  placeholder="e.g. Single room upgrade, roommate adjustment"
                  value={reassignForm.reason}
                  onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setIsReassignOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">Confirm Reassignment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

