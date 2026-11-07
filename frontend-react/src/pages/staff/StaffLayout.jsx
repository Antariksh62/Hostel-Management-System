import React, { useContext } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { Activity, History, User, Wrench, Building2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/hms/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AdminNotificationBell from "@/components/notifications/AdminNotificationBell";
import { AuthContext } from "@/context/AuthContext";
import api from "@/services/api";

export default function StaffLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: deptInfo } = useQuery({
    queryKey: ["staff-department-info"],
    queryFn: () => api.get("/staff/department-info").then(r => r.data).catch(() => null),
    staleTime: 30000
  });

  const deptName = deptInfo?.department?.name || user?.department || "Maintenance";
  const deptCode = deptInfo?.department?.code || user?.departmentCode || "";
  const isSupervisor = Boolean(deptInfo?.isSupervisor || user?.isSupervisor);
  const designation = user?.designation || user?.staffRole || "Technician";

  return (
    <AppShell
      product={t("common.app_title", "Hostel Management")}
      roleLabel={`${deptName} Department${isSupervisor ? " • Supervisor" : ""}`}
      userName={user?.name || "Staff Member"}
      userSubtitle={`${designation} • ${user?.email || ""}`}
      nav={[
        { to: "/staff-dashboard", label: t("nav.my_work", "My work"), icon: Wrench },
        { to: "/staff-dashboard/heatmap", label: t("nav.service_monitor", "Floor Heat Map"), icon: Activity },
        { to: "/staff-dashboard/history", label: t("nav.history", "History"), icon: History },
        { to: "/staff-dashboard/profile", label: t("nav.profile", "Profile"), icon: User },
      ]}
      actions={
        <div className="flex items-center gap-2">
          {deptCode && (
            <Badge variant="outline" className="hidden sm:inline-flex text-[11px] font-mono uppercase bg-muted/50">
              <Building2 className="w-3 h-3 mr-1" />
              {deptCode}
            </Badge>
          )}
          {isSupervisor && (
            <Badge variant="secondary" className="hidden sm:inline-flex text-[11px] font-semibold text-primary">
              <ShieldCheck className="w-3 h-3 mr-1" />
              Supervisor
            </Badge>
          )}
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
