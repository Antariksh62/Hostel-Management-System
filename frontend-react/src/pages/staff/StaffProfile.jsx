import React, { useContext } from "react";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/hms/app-shell";
import { AuthContext } from "@/context/AuthContext";

export default function StaffProfile() {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);

  const staffId = (user?.id || user?._id || "STAFF").slice(-6).toUpperCase();

  const rows = [
    [t("staff.full_name", "Full name"), user?.name || "—"],
    [t("staff.email_address", "Email address"), user?.email || "—"],
    [t("staff.staff_id", "Staff ID"), `STF-${staffId}`],
    [t("staff.role", "Role"), t("staff.maintenance_staff", "Hostel Maintenance Staff")],
    [t("staff.office_location", "Office location"), user?.officeLocation || t("staff.maintenance_office_location", "Hostel Maintenance Office, Ground Floor")],
    [t("staff.shift", "Shift"), user?.shift || t("staff.general_day_shift", "General Day Shift (8:00 AM – 6:00 PM)")],
  ];

  return (
    <>
      <PageHeader
        title={t("staff.staff_profile", "Staff Profile")}
        description={t("staff.operational_record", "Your operational record on file.")}
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
