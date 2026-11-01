import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Building,
  ChevronLeft,
  ChevronRight,
  Filter,
  GraduationCap,
  Loader2,
  Lock,
  Search,
  User,
  X
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import api from "@/services/api";

const BRANCHES = ["CE", "ENTC", "IT", "AIDS", "ECE"];
const YEARS = ["FY", "SY", "TY"];

export default function ResidentDirectory({ onSelectResident }) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  // Filter states
  const [selectedFloor, setSelectedFloor] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [roomStatus, setRoomStatus] = useState("");
  const [profileStatus, setProfileStatus] = useState("");

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
      setPage(1); // Reset to page 1 on new search
    }, 350);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Query resident directory
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "residents-directory",
      page,
      limit,
      debouncedQuery,
      selectedFloor,
      selectedBranch,
      selectedYear,
      roomStatus,
      profileStatus,
    ],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (debouncedQuery) params.append("q", debouncedQuery);
      if (selectedFloor) params.append("floor", selectedFloor);
      if (selectedBranch) params.append("branch", selectedBranch);
      if (selectedYear) params.append("year", selectedYear);
      if (roomStatus) params.append("roomStatus", roomStatus);
      if (profileStatus) params.append("profileStatus", profileStatus);

      return api.get(`/residents?${params.toString()}`).then((r) => r.data);
    },
    keepPreviousData: true,
  });

  const residents = data?.residents || [];
  const pagination = data?.pagination || { total: 0, page: 1, totalPages: 1 };

  const hasActiveFilters = Boolean(
    debouncedQuery || selectedFloor || selectedBranch || selectedYear || roomStatus || profileStatus
  );

  const handleClearFilters = () => {
    setSearchInput("");
    setDebouncedQuery("");
    setSelectedFloor("");
    setSelectedBranch("");
    setSelectedYear("");
    setRoomStatus("");
    setProfileStatus("");
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* Unified search input */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by student name, surname, PRN, roll number, room, or parent/emergency phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 pr-9 h-10 text-sm"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Floor filter */}
            <select
              value={selectedFloor}
              onChange={(e) => {
                setSelectedFloor(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">All Floors</option>
              <option value="1">Floor 1</option>
              <option value="2">Floor 2</option>
              <option value="3">Floor 3</option>
              <option value="4">Floor 4</option>
              <option value="5">Floor 5</option>
            </select>

            {/* Branch filter */}
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">All Branches</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {/* Year filter */}
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">All Years</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Room Assignment Filter */}
            <select
              value={roomStatus}
              onChange={(e) => {
                setRoomStatus(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">All Room Status</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>

            {/* Profile Status */}
            <select
              value={profileStatus}
              onChange={(e) => {
                setProfileStatus(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">All Profiles</option>
              <option value="complete">Complete</option>
              <option value="incomplete">Incomplete</option>
            </select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-10 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Search helper notice */}
        {debouncedQuery && (
          <div className="text-xs text-muted-foreground flex items-center justify-between pt-1 border-t border-border/40">
            <span>
              Searching for: <strong className="text-foreground">"{debouncedQuery}"</strong> ({pagination.total} matching residents)
            </span>
            <span className="text-[11px] italic">
              Searches across name parts, PRN, roll, room, and parent/emergency phone contacts
            </span>
          </div>
        )}
      </div>

      {/* Residents Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 sm:px-6">Student Name</th>
                <th className="px-4 py-3">PRN</th>
                <th className="px-4 py-3">Roll No</th>
                <th className="px-4 py-3">Branch / Year</th>
                <th className="px-4 py-3">Div</th>
                <th className="px-4 py-3">Room / Floor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted-foreground">
                    <Loader2 className="size-6 animate-spin mx-auto mb-2 text-primary" />
                    Loading resident directory...
                  </td>
                </tr>
              ) : residents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-muted-foreground">
                    <p className="text-base font-semibold text-foreground">No matching residents found</p>
                    <p className="text-xs mt-1">Try adjusting your search criteria or filter selections.</p>
                    {hasActiveFilters && (
                      <Button variant="outline" size="sm" onClick={handleClearFilters} className="mt-3">
                        Clear all filters
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                residents.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => onSelectResident(r.id)}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <td className="px-4 py-3.5 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
                          {r.name?.[0] || "S"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground text-sm">{r.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{r.email}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">{r.prn}</td>
                    <td className="px-4 py-3.5 font-mono text-xs">{r.rollNumber}</td>

                    <td className="px-4 py-3.5 text-xs">
                      <span className="font-medium text-foreground">{r.branch}</span>
                      <span className="text-muted-foreground"> • {r.year}</span>
                    </td>

                    <td className="px-4 py-3.5 text-xs text-muted-foreground">{r.classDiv}</td>

                    <td className="px-4 py-3.5 text-xs">
                      {r.isAssigned ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground">Room {r.doorNumber}</span>
                          <span className="text-muted-foreground text-[11px]">(F{r.floor})</span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10">
                          Unassigned
                        </Badge>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-xs">
                      <div className="flex flex-col gap-1 items-start">
                        {r.matchedCategory && (
                          <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                            Matched: {r.matchedCategory}
                          </Badge>
                        )}
                        <span className={`text-[11px] font-medium ${r.profileComplete ? "text-emerald-500" : "text-amber-500"}`}>
                          {r.profileComplete ? "Complete" : "Incomplete Profile"}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs cursor-pointer hover:bg-primary/10 hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectResident(r.id);
                        }}
                      >
                        View Profile
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-6 bg-muted/20 text-xs text-muted-foreground">
          <div>
            Showing <strong className="text-foreground">{residents.length}</strong> of{" "}
            <strong className="text-foreground">{pagination.total}</strong> registered residents
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span>
              Page <strong className="text-foreground">{pagination.page}</strong> of{" "}
              <strong className="text-foreground">{pagination.totalPages}</strong>
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.totalPages || isFetching}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

