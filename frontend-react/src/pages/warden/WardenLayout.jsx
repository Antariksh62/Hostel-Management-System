import React, { useContext } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { ClipboardList, DoorOpen, LayoutDashboard, Users } from "lucide-react";

import { AppShell } from "@/components/hms/app-shell";
import { Button } from "@/components/ui/button";
import { AuthContext } from "@/context/AuthContext";

export default function WardenLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <AppShell
      product="Hostel Management"
      roleLabel="Warden"
      userName={user?.name || "Hostel Warden"}
      userSubtitle={user?.officeLocation || user?.email || "Hostel Office"}
      nav={[
        { to: "/admin-dashboard", label: "Overview", icon: LayoutDashboard },
        { to: "/admin-dashboard/complaints", label: "Complaints", icon: ClipboardList },
        { to: "/admin-dashboard/rooms", label: "Rooms", icon: DoorOpen },
        { to: "/admin-dashboard/staff", label: "Staff", icon: Users },
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
