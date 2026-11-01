import React, { useContext, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { ClipboardList, DoorOpen, Home, User } from "lucide-react";
import { useTranslation } from "react-i18next";

import { AppShell } from "@/components/hms/app-shell";
import { Button } from "@/components/ui/button";
import { AuthContext } from "@/context/AuthContext";

export default function StudentLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // Students are strictly English-only
  useEffect(() => {
    if (i18n.language !== "en") {
      i18n.changeLanguage("en");
    }
  }, [i18n]);

  const roomText = user?.doorNumber ? `${t("common.room", "Room")} ${user.doorNumber}` : t("common.residents", "Hostel Resident");

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
