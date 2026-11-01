const fs = require('fs');
const path = require('path');

// 1. WardenLayout
const wardenPath = path.join(__dirname, '../frontend-react/src/pages/warden/WardenLayout.jsx');
const wardenCode = `import React, { useContext } from "react";
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
`;
fs.writeFileSync(wardenPath, wardenCode, 'utf8');

// 2. HeadWardenLayout
const headWardenPath = path.join(__dirname, '../frontend-react/src/pages/headwarden/HeadWardenLayout.jsx');
const headWardenCode = `import React, { useContext } from "react";
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
`;
fs.writeFileSync(headWardenPath, headWardenCode, 'utf8');

// 3. StudentLayout
const studentPath = path.join(__dirname, '../frontend-react/src/pages/student/StudentLayout.jsx');
const studentCode = `import React, { useContext } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { ClipboardList, DoorOpen, Home, User } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppShell } from "@/components/hms/app-shell";
import { Button } from "@/components/ui/button";
import { AuthContext } from "@/context/AuthContext";

export default function StudentLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const roomText = user?.doorNumber ? \`\${t("common.room", "Room")} \${user.doorNumber}\` : t("common.residents", "Hostel Resident");

  return (
    <AppShell
      product={t("common.app_title", "Hostel Management")}
      roleLabel={t("auth.student_tab", "Student")}
      userName={user?.fullName || user?.name || "Student"}
      userSubtitle={roomText}
      nav={[
        { to: "/student-dashboard", label: t("nav.home", "Home"), icon: Home },
        { to: "/student-dashboard/complaints", label: t("nav.complaints", "Complaints"), icon: ClipboardList },
        { to: "/student-dashboard/room", label: t("nav.my_room", "My room"), icon: DoorOpen },
        { to: "/student-dashboard/profile", label: t("nav.profile", "Profile"), icon: User },
      ]}
      actions={
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
      }
    >
      <Outlet />
    </AppShell>
  );
}
`;
fs.writeFileSync(studentPath, studentCode, 'utf8');

// 4. StaffLayout
const staffPath = path.join(__dirname, '../frontend-react/src/pages/staff/StaffLayout.jsx');
const staffCode = `import React, { useContext } from "react";
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
`;
fs.writeFileSync(staffPath, staffCode, 'utf8');

console.log('✅ All 4 role layouts successfully updated with i18n support!');

