import React, { useContext } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Activity, BarChart3, ClipboardList, DoorOpen, LayoutDashboard, UserCheck, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppShell } from "@/components/hms/app-shell";
import { Button } from "@/components/ui/button";
import AdminNotificationBell from "@/components/notifications/AdminNotificationBell";
import { AuthContext } from "@/context/AuthContext";

export default function WardenLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <AppShell
      product={t("common.app_title", "Hostel Management")}
      roleLabel={user?.role === "INCHARGE" ? t("common.operations_intelligence", "Hostel In-Charge") : t("common.hostel_administration", "Warden")}
      userName={user?.name || (user?.role === "INCHARGE" ? "Hostel In-Charge" : "Hostel Warden")}
      userSubtitle={user?.officeLocation || user?.email || "Hostel Office"}
      nav={[
        { to: "/admin-dashboard", label: t("nav.overview", "Overview"), icon: LayoutDashboard },
        { to: "/admin-dashboard/services", label: t("nav.service_monitor", "Service Monitor"), icon: Activity },
        { to: "/admin-dashboard/complaints", label: t("nav.complaints", "Complaints"), icon: ClipboardList },
        { to: "/admin-dashboard/residents", label: t("nav.residents", "Residents"), icon: Users },
        { to: "/admin-dashboard/rooms", label: t("nav.rooms", "Rooms"), icon: DoorOpen },
        { to: "/admin-dashboard/staff", label: t("nav.staff", "Staff"), icon: UserCheck },
        { to: "/admin-dashboard/staff-performance", label: t("nav.staff_performance", "Staff Performance"), icon: BarChart3 },
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
