import React, { useState, useEffect, useContext, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  Flame,
  Info,
  ShieldAlert,
  UserCheck,
  Wrench,
  X
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import api from "@/services/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const formatCategoryLabel = (cat) => {
  if (!cat) return "";
  return cat.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
};

// Removes ugly raw IDs (e.g. #3d9de0) and formats categories cleanly
const cleanNotificationTitle = (title) => {
  if (!title) return "";
  // Strip "#<hex/alphanumeric id>" like "#3d9de0", "#3d9ddc", "#123456"
  let clean = title.replace(/\s*#[a-f0-9]{4,12}\b/gi, "");
  // Format snake_case inside parentheses: (NO_ELECTRICITY) -> (No Electricity)
  clean = clean.replace(/\(([^)]+)\)/g, (match, inner) => {
    return `(${formatCategoryLabel(inner)})`;
  });
  return clean.trim();
};

export default function AdminNotificationBell({ className }) {
  const { user } = useContext(AuthContext);
  const { socket } = useSocket();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all"); // "all" | "unread"

  const dropdownRef = useRef(null);

    const getLocalizedTitle = (notif) => {
    if (!notif?.title) return "";
    if (notif.title.includes("New Complaint")) {
      const match = notif.title.match(/\(([^)]+)\)/);
      const catKey = match ? match[1] : notif.metadata?.category;
      const transCat = catKey ? t("categories." + catKey, formatCategoryLabel(catKey)) : "";
      return t("notifications.complaint_created", {
        room: notif.metadata?.room || notif.metadata?.doorNumber || "",
        title: transCat || cleanNotificationTitle(notif.title)
      });
    }
    return cleanNotificationTitle(notif.title);
  };

  // Fetch notifications from backend
  const fetchNotifications = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const res = await api.get("/notifications?limit=25");
      setNotifications(res.data.notifications || []);
      const countRes = await api.get("/notifications/unread-count");
      setUnreadCount(countRes.data.unreadCount || 0);
    } catch (err) {
      console.error("Failed to load notifications:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  // Real-time socket event subscription
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notif) => {
      setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
      setUnreadCount((prev) => prev + 1);

      // Toast alert
      if (notif.priority === "URGENT" || notif.priority === "HIGH") {
        toast.error(cleanNotificationTitle(notif.title), {
          description: notif.message,
          duration: 6000
        });
      } else {
        toast.info(cleanNotificationTitle(notif.title), {
          description: notif.message,
          duration: 4000
        });
      }
    };

    socket.on("notification:new", handleNewNotification);

    return () => {
      socket.off("notification:new", handleNewNotification);
    };
  }, [socket]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id || n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post("/notifications/mark-all-read");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  };

  const handleNotificationClick = (notif) => {
    if (!notif.read) {
      handleMarkAsRead(notif._id || notif.id);
    }
    setIsOpen(false);

    // Contextual routing based on entityType and user role
    if (notif.entityType === "admission" || notif.category === "ADMISSION") {
      if (user?.role === "HEADWARDEN") {
        navigate("/headwarden-dashboard/admissions");
      } else if (user?.role === "INCHARGE") {
        navigate("/incharge-dashboard?view=admissions");
      }
    } else if (notif.entityType === "complaint") {
      if (user?.role === "WIFI_INCHARGE") {
        navigate("/wifi-dashboard");
      } else if (user?.role === "STAFF") {
        navigate("/staff-dashboard");
      } else if (user?.role === "HEADWARDEN") {
        navigate("/headwarden-dashboard/complaints");
      } else if (user?.role === "WARDEN") {
        navigate("/admin-dashboard/complaints");
      } else if (user?.role === "INCHARGE") {
        navigate("/incharge-dashboard");
      }
    }
  };

  const getPriorityIndicator = (priority) => {
    switch (priority) {
      case "URGENT":
        return <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span></span>;
      case "HIGH":
        return <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />;
      case "MEDIUM":
        return <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />;
      default:
        return <span className="h-2 w-2 rounded-full bg-muted-foreground shrink-0" />;
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "";
    const seconds = Math.floor((new Date() - new Date(dateStr)) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const filteredNotifications = activeTab === "unread"
    ? notifications.filter((n) => !n.read)
    : notifications;

  return (
    <div className={cn("relative inline-block text-left", className)} ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notifications, ${unreadCount} unread`}
        className="relative size-9 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!isOpen) fetchNotifications();
        }}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex min-w-4 h-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-xs animate-in zoom-in-75">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-11 z-50 w-80 sm:w-96 rounded-xl border border-border bg-popover shadow-xl transition-all duration-150 animate-in fade-in-50 zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">{t("notifications.title", "Notifications")}</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-bold">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline font-medium cursor-pointer"
              >
                {t("notifications.mark_all_read", "Mark all read")}
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex border-b border-border/60 bg-muted/30 px-3 py-1.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                activeTab === "all"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("notifications.all_tab", "All ({{count}})", { count: notifications.length })}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("unread")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer ml-1",
                activeTab === "unread"
                  ? "bg-background text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("notifications.unread_tab", "Unread ({{count}})", { count: unreadCount })}
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40">
            {loading && notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Loading notifications...
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="size-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs font-medium text-foreground">{t("notifications.empty_notifications", "No notifications")}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {activeTab === "unread" ? "You have caught up with all updates!" : "Activity alerts will show up here."}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const isRead = notif.read;
                return (
                  <div
                    key={notif._id || notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={cn(
                      "flex items-start gap-3 p-3 text-left transition-colors cursor-pointer hover:bg-muted/50",
                      !isRead && "bg-primary/5"
                    )}
                  >
                    <div className="mt-1 shrink-0">
                      {getPriorityIndicator(notif.priority)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className={cn("text-xs font-semibold truncate", !isRead ? "text-foreground font-bold" : "text-foreground/90")}>
                          {getLocalizedTitle(notif)}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notif.message}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {notif.category}
                        </span>
                        {notif.metadata?.room && (
                          <span className="text-[10px] text-muted-foreground">
                            Room {notif.metadata.room}
                          </span>
                        )}
                      </div>
                    </div>
                    {!isRead && (
                      <button
                        type="button"
                        title="Mark as read"
                        onClick={(e) => handleMarkAsRead(notif._id || notif.id, e)}
                        className="size-6 shrink-0 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <Check className="size-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

