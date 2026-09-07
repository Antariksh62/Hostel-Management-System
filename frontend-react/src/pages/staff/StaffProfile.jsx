import React, { useContext } from "react";
import { PageHeader } from "@/components/hms/app-shell";
import { AuthContext } from "@/context/AuthContext";

export default function StaffProfile() {
  const { user } = useContext(AuthContext);

  const staffId = (user?.id || user?._id || "STAFF").slice(-6).toUpperCase();

  const rows = [
    ["Full name", user?.name || "—"],
    ["Email address", user?.email || "—"],
    ["Staff ID", `STF-${staffId}`],
    ["Role", "Hostel Maintenance Staff"],
    ["Office location", user?.officeLocation || "Hostel Maintenance Office, Ground Floor"],
    ["Shift", user?.shift || "General Day Shift (8:00 AM – 6:00 PM)"],
  ];

  return (
    <>
      <PageHeader
        title="Staff Profile"
        description="Your operational record on file."
      />

      <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="truncate text-sm font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
