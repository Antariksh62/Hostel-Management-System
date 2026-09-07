import React, { useContext, useEffect, useState } from "react";
import { DoorOpen, Loader2 } from "lucide-react";

import { PageHeader, EmptyState } from "@/components/hms/app-shell";
import { ComplaintCard } from "@/components/hms/complaint-card";
import { AuthContext } from "@/context/AuthContext";
import api from "@/services/api";

export default function StudentRoom() {
  const { user } = useContext(AuthContext);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  const room = user?.doorNumber || "—";
  const floor = user?.doorNumber ? user.doorNumber[0] : "—";

  useEffect(() => {
    async function fetchRoomComplaints() {
      try {
        const res = await api.get("/complaints/my-complaints");
        const list = res.data || [];
        setComplaints(list.filter((c) => c.doorNumber === user?.doorNumber || !c.doorNumber));
      } catch (err) {
        console.error("Failed to load room complaints:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchRoomComplaints();
  }, [user]);

  return (
    <>
      <PageHeader
        title={`Room ${room}`}
        description={`Floor ${floor} · Hostel Accommodation`}
      />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          ["Room number", room],
          ["Floor", `Floor ${floor}`],
          ["Occupancy status", "Allotted & Occupied"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-8 mb-3 text-sm font-semibold">Maintenance history for this room</h2>

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : complaints.length === 0 ? (
        <EmptyState
          icon={DoorOpen}
          title="No room issues recorded"
          description="Any issues raised for this room will appear here."
        />
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => (
            <ComplaintCard key={c._id || c.id} complaint={c} />
          ))}
        </div>
      )}
    </>
  );
}
