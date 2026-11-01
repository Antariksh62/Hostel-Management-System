import React, { useContext } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Activity, History, User, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppShell } from "@/components/hms/app-shell";
import { Button } from "@/components/ui/button";
import AdminNotificationBell from "@/components/notifications/AdminNotificationBell";
import { AuthContext } from "@/context/AuthContext";

export default function StaffLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <AppShell
      product={t("common.app_title", "Hostel Management")}
      roleLabel={t("nav.staff", "Maintenance Staff")}
      userName={user?.name || "Maintenance Staff"}
      userSubtitle={user?.email || "Hostel Maintenance"}
      nav={[
        { to: "/staff-dashboard", label: t("nav.my_work", "My work"), icon: Wrench },
        { to: "/staff-dashboard/heatmap", label: t("nav.service_monitor", "Floor Heat Map"), icon: Activity },
        { to: "/staff-dashboard/history", label: t("nav.history", "History"), icon: History },
        { to: "/staff-dashboard/profile", label: t("nav.profile", "Profile"), icon: User },
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
