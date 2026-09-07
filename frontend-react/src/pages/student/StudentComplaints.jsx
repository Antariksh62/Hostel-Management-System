import React, { useContext, useEffect, useState, useCallback } from "react";
import { ClipboardList, Plus, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, PageHeader } from "@/components/hms/app-shell";
import { ComplaintCard } from "@/components/hms/complaint-card";
import { MediaGallery } from "@/components/hms/media-gallery";
import { MediaUploader } from "@/components/hms/media-uploader";
import { ComplaintHeader, ComplaintMeta, DetailSection, ResolutionSummary } from "@/components/hms/complaint-detail";
import { ComplaintTimeline } from "@/components/hms/complaint-timeline";
import { formatDateTime } from "@/components/hms/status";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AuthContext } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import api from "@/services/api";

const CATEGORIES = ["Electrical", "Plumbing", "Furniture", "Cleanliness", "Internet", "Other"];

export default function StudentComplaints() {
  const { user } = useContext(AuthContext);
  const { socket } = useSocket();

  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [selected, setSelected] = useState(null);

  // New Complaint Form
  const [category, setCategory] = useState("Electrical");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Feedback State for selected complaint
  const [feedbackSatisfied, setFeedbackSatisfied] = useState(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackFiles, setFeedbackFiles] = useState([]);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  const fetchMyComplaints = useCallback(async () => {
    try {
      const res = await api.get("/complaints/my-complaints");
      setComplaints(res.data || []);
    } catch (err) {
      console.error("Failed to fetch complaints:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyComplaints();
  }, [fetchMyComplaints]);

  // Real-time socket updates
  useEffect(() => {
    if (!socket) return;

    const handleCreated = (newComplaint) => {
      const isMine =
        newComplaint.studentId === (user?.id || user?._id) ||
        newComplaint.studentId?._id === (user?.id || user?._id);
      if (isMine) {
        setComplaints((prev) => {
          const exists = prev.some((c) => c._id === newComplaint._id);
          return exists ? prev : [newComplaint, ...prev];
        });
      }
    };

    const handleStatusUpdated = ({ complaintId, complaint, status }) => {
      setComplaints((prev) =>
        prev.map((c) => {
          if (c._id === complaintId) {
            const updated = complaint ? { ...c, ...complaint } : { ...c, status: status || c.status };
            if (selected && selected._id === complaintId) setSelected(updated);
            return updated;
          }
          return c;
        })
      );
    };

    socket.on("complaint:created", handleCreated);
    socket.on("complaint:status-updated", handleStatusUpdated);

    return () => {
      socket.off("complaint:created", handleCreated);
      socket.off("complaint:status-updated", handleStatusUpdated);
    };
  }, [socket, user, selected]);

  // Submit New Complaint
  async function handleSubmitComplaint(e) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      toast.error("Please enter a title and description.");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      fd.append("category", category);
      if (user?.doorNumber) {
        fd.append("doorNumber", user.doorNumber);
      }

      // Attach real files
      attachments.forEach((att) => {
        if (att.file) {
          if (att.type === "video") {
            fd.append("video", att.file);
          } else {
            fd.append("images", att.file);
          }
        }
      });

      const res = await api.post("/complaints", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Complaint submitted successfully!");
      setTitle("");
      setDescription("");
      setAttachments([]);
      setOpenNew(false);

      const createdComplaint = res.data?.complaint || res.data;
      if (createdComplaint && createdComplaint._id) {
        setComplaints((prev) => {
          const exists = prev.some((c) => c._id === createdComplaint._id);
          return exists ? prev : [createdComplaint, ...prev];
        });
      } else {
        fetchMyComplaints();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit complaint.");
    } finally {
      setSubmitting(false);
    }
  }

  // Submit Feedback
  async function handleSubmitFeedback(e) {
    e.preventDefault();
    if (!selected) return;

    if (feedbackSatisfied === false && !feedbackText.trim()) {
      toast.error("Please provide an explanation of why it was not resolved.");
      return;
    }

    setFeedbackSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("isSatisfied", feedbackSatisfied);
      fd.append("text", feedbackText.trim());

      feedbackFiles.forEach((file) => {
        if (file.type.startsWith("video/")) {
          fd.append("video", file);
        } else {
          fd.append("images", file);
        }
      });

      await api.post(`/complaints/${selected._id}/feedback`, fd);

      toast.success(
        feedbackSatisfied
          ? "Thank you for your feedback!"
          : "Complaint reopened for further maintenance."
      );

      setFeedbackSatisfied(null);
      setFeedbackText("");
      setFeedbackFiles([]);
      setSelected(null);
      fetchMyComplaints();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit feedback.");
    } finally {
      setFeedbackSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="My complaints"
        description="Every request you have raised, newest first."
        action={
          <Button className="min-h-11" onClick={() => setOpenNew(true)}>
            <Plus className="mr-1 size-4" aria-hidden />
            New complaint
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : complaints.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No complaints yet"
          description="Report a maintenance problem and track its progress here."
          action={<Button onClick={() => setOpenNew(true)}>Report a problem</Button>}
        />
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => (
            <ComplaintCard
              key={c._id || c.id}
              complaint={c}
              onClick={() => {
                setSelected(c);
                setFeedbackSatisfied(null);
                setFeedbackText("");
                setFeedbackFiles([]);
              }}
            />
          ))}
        </div>
      )}

      {/* New Complaint Dialog */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Report a problem</DialogTitle>
            <DialogDescription>
              Let the maintenance team know what needs attention in room {user?.doorNumber || "your room"}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitComplaint} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="cat" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="title">Summary</Label>
              <Input
                id="title"
                required
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Bathroom tap leaking constantly"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="desc">Details</Label>
              <Textarea
                id="desc"
                required
                rows={3}
                maxLength={600}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe where the problem is and how long it's been happening..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Photos or video (optional)</Label>
              <MediaUploader attachments={attachments} onChange={setAttachments} />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenNew(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Submit complaint
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Complaint Detail Dialog */}
      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          {selected && (
            <div className="space-y-6">
              <DialogHeader>
                <ComplaintHeader complaint={selected} />
              </DialogHeader>

              <ComplaintMeta
                items={[
                  { label: "Room", value: `Room ${selected.doorNumber || selected.room || user?.doorNumber || "—"}` },
                  { label: "Category", value: selected.category },
                  { label: "Reported", value: formatDateTime(selected.createdAt) },
                  { label: "Assigned to", value: selected.assignedTo?.name || "Unassigned" },
                ]}
              />

              <DetailSection title="Description">
                <p className="text-sm leading-relaxed text-foreground">{selected.description}</p>
              </DetailSection>

              {(selected.media?.length > 0 || selected.attachments?.length > 0 || selected.image) && (
                <DetailSection title="Evidence">
                  <MediaGallery
                    media={selected.media}
                    image={selected.image}
                    attachments={selected.attachments}
                  />
                </DetailSection>
              )}

              <DetailSection title="Timeline">
                <ComplaintTimeline complaint={selected} variant="student" />
              </DetailSection>

              <ResolutionSummary complaint={selected} />

              {/* Feedback Section if Resolved */}
              {(selected.status === "Resolved" || selected.status === "resolved") && (
                <DetailSection title="Resolution Feedback">
                  {selected.feedback?.isSatisfied !== undefined && selected.feedback?.isSatisfied !== null ? (
                    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                      <div className="flex items-center gap-2 font-medium">
                        {selected.feedback.isSatisfied ? (
                          <>
                            <CheckCircle2 className="size-4 text-[var(--hms-success)]" />
                            <span>Marked satisfied by you</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="size-4 text-amber-500" />
                            <span>Marked unsatisfied by you</span>
                          </>
                        )}
                      </div>
                      {selected.feedback.text && (
                        <p className="mt-1.5 text-xs text-muted-foreground">{selected.feedback.text}</p>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitFeedback} className="space-y-3 rounded-lg border border-border bg-card p-4">
                      <p className="text-sm font-medium">Was your issue resolved to your satisfaction?</p>
                      <div className="flex gap-3">
                        <Button
                          type="button"
                          variant={feedbackSatisfied === true ? "default" : "outline"}
                          className="flex-1"
                          onClick={() => setFeedbackSatisfied(true)}
                        >
                          Yes, satisfied
                        </Button>
                        <Button
                          type="button"
                          variant={feedbackSatisfied === false ? "destructive" : "outline"}
                          className="flex-1"
                          onClick={() => setFeedbackSatisfied(false)}
                        >
                          No, still needs work
                        </Button>
                      </div>

                      {feedbackSatisfied === false && (
                        <div className="space-y-2 pt-2">
                          <Label htmlFor="fb-reason" className="text-xs">
                            What went wrong?
                          </Label>
                          <Textarea
                            id="fb-reason"
                            rows={2}
                            required
                            placeholder="Explain why the work is incomplete or what remains broken..."
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                          />
                        </div>
                      )}

                      {feedbackSatisfied !== null && (
                        <Button type="submit" disabled={feedbackSubmitting} className="w-full">
                          {feedbackSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                          Submit feedback
                        </Button>
                      )}
                    </form>
                  )}
                </DetailSection>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
