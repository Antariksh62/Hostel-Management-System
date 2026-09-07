import React, { useContext } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { ClipboardList, DoorOpen, Home, User } from "lucide-react";

import { AppShell } from "@/components/hms/app-shell";
import { Button } from "@/components/ui/button";
import { AuthContext } from "@/context/AuthContext";

export default function StudentLayout() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const roomText = user?.doorNumber ? `Room ${user.doorNumber}` : "Hostel Resident";

  return (
    <AppShell
      product="Hostel Management"
      roleLabel="Student"
      userName={user?.fullName || user?.name || "Student"}
      userSubtitle={roomText}
      nav={[
        { to: "/student-dashboard", label: "Home", icon: Home },
        { to: "/student-dashboard/complaints", label: "Complaints", icon: ClipboardList },
        { to: "/student-dashboard/room", label: "My room", icon: DoorOpen },
        { to: "/student-dashboard/profile", label: "Profile", icon: User },
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
