import React, { useContext } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { History, User, Wrench } from "lucide-react";

import { AppShell } from "@/components/hms/app-shell";
import { Button } from "@/components/ui/button";
import { AuthContext } from "@/context/AuthContext";

export default function StaffLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <AppShell
      product="Hostel Management"
      roleLabel="Maintenance Staff"
      userName={user?.name || "Maintenance Staff"}
      userSubtitle={user?.email || "Hostel Maintenance"}
      nav={[
        { to: "/staff-dashboard", label: "My work", icon: Wrench },
        { to: "/staff-dashboard/history", label: "History", icon: History },
        { to: "/staff-dashboard/profile", label: "Profile", icon: User },
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
          Sign out
        </Button>
      }
    >
      <Outlet />
    </AppShell>
  );
}
