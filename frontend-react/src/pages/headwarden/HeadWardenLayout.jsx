import React, { useContext } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  ClipboardList,
  DoorOpen,
  GraduationCap,
  LayoutDashboard,
  Shield,
  UserCheck,
  Users
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppShell } from "@/components/hms/app-shell";
import { Button } from "@/components/ui/button";
import AdminNotificationBell from "@/components/notifications/AdminNotificationBell";
import { AuthContext } from "@/context/AuthContext";

export default function HeadWardenLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <AppShell
      product={t("common.hostel_administration", "Hostel Administration")}
      roleLabel="Head Warden"
      userName={user?.name || "Head Warden"}
      userSubtitle={user?.email || "Hostel Central Office"}
      nav={[
        { to: "/headwarden-dashboard", label: t("nav.overview", "Overview"), icon: LayoutDashboard },
        { to: "/headwarden-dashboard/admissions", label: t("nav.student_admission", "Student Admission"), icon: GraduationCap },
        { to: "/headwarden-dashboard/services", label: t("nav.service_monitor", "Service Monitor"), icon: Activity },
        { to: "/headwarden-dashboard/complaints", label: t("nav.complaints", "Complaints"), icon: ClipboardList },
        { to: "/headwarden-dashboard/residents", label: t("nav.resident_management", "Resident Management"), icon: Users },
        { to: "/headwarden-dashboard/rooms", label: t("nav.rooms_and_heatmap", "Rooms & Heatmap"), icon: DoorOpen },
        { to: "/headwarden-dashboard/staff", label: t("nav.staff_roster", "Staff Roster"), icon: UserCheck },
        { to: "/headwarden-dashboard/staff-performance", label: t("nav.staff_performance", "Staff Performance"), icon: BarChart3 },
      ]}
      actions={
        <div className="flex items-center gap-1.5">
          <AdminNotificationBell />
          <Button
            variant="ghost"
            className="min-h-10 text-sm font-medium cursor-pointer"
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            {t("common.sign_out", "Sign out")}
          </Button>
        </div>
      }
    >
      <Outlet />
    </AppShell>
  );
}
