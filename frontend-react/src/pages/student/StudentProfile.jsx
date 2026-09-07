import React, { useContext } from "react";
import { PageHeader } from "@/components/hms/app-shell";
import { AuthContext } from "@/context/AuthContext";

export default function StudentProfile() {
  const { user } = useContext(AuthContext);

  if (!user) return null;

  const rows = [
    ["Full name", user.fullName || user.name || "—"],
    ["College email", user.email || "—"],
    ["PRN", user.prn || "—"],
    ["Branch", user.branch || "—"],
    ["Division / Class", user.classDiv || "—"],
    ["Roll number", user.rollNumber || "—"],
    ["Academic year", user.year || "—"],
    ["Joining year", user.joiningYear ? String(user.joiningYear) : "—"],
    ["Room", user.doorNumber || "—"],
  ];

  return (
    <>
      <PageHeader
        title="Student Profile"
        description="Your verified identity record on file with the hostel office."
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
