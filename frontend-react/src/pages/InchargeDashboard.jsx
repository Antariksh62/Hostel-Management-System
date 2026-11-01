/**
 * InchargeDashboard.jsx
 *
 * Route:    /incharge-dashboard
 * Roles:    INCHARGE (and HEADWARDEN)
 *
 * Consolidated, cohesive operations intelligence workspace for the Hostel Incharge.
 * Integrates:
 *   A. Overview: Executive Brief, Signal Strip & Operational KPIs (with live WebSocket updates)
 *   B. Complaints & Hotspots: 77-Room Spatial Heatmap & Lifecycle Triage
 *   C. Residents & Rooms: Audited Resident Directory & 77-Room Occupancy (ResidentManagement)
 *   D. Staff Oversight: Workload & Verified Resolution Attribution (StaffPerformanceAnalytics)
 *   E. Wi-Fi Dashboard: Specialist networking portal
 *
 * Completely stripped of:
 *   - Mission Control AI & fabricated financial figures
 *   - Speculative Forecast Band & stock depletion
 *   - Standalone Investigation Drawer & drilldown sheets
 *   - Redundant Student Admission registration management (handled by tech team)
 *   - Artificial Today's Priority and Executive Summary blocks
 *   - Redundant Occupancy Rate signal
 */

import React, { useState, useEffect, Suspense, useContext } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock,
  DoorOpen,
  GraduationCap,
  Layers,
  Loader2,
  TrendingUp,
  UserCheck,
  Users,
  Wifi,
  Wrench,
} from 'lucide-react';

import { InvestigationProvider } from '@/components/hoidss/context';
import { HeatmapBand } from '@/components/hoidss/heatmap';
import { ComplaintsBand } from '@/components/hoidss/complaints';
import { MorningBrief } from '@/components/hoidss/morning-brief';
import { OwnershipBand } from '@/components/hoidss/ownership';
import { HostelSidebar, TopBar } from '@/components/hoidss/shell';
import { SignalStrip } from '@/components/hoidss/signals';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AuthContext } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import api from '@/services/api';

// Lazy-loaded submodules
const ResidentManagement = React.lazy(() => import('@/pages/residents/ResidentManagement'));
const StaffPerformanceAnalytics = React.lazy(() => import('@/components/analytics/StaffPerformanceAnalytics'));
const WardenComplaints = React.lazy(() => import('@/pages/warden/WardenComplaints'));
const StudentAdmissionModule = React.lazy(() => import('@/components/admissions/StudentAdmissionModule'));

function LoadingFallback({ message = "Loading module..." }) {
  return (
    <div className="flex flex-col items-center justify-center p-16 space-y-3">
      <Loader2 className="size-8 text-primary animate-spin" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}

export default function InchargeDashboard() {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Active tab state: defaults to 'overview'
  const paramTab = searchParams.get('tab') || 'overview';
  const validTabs = ['overview', 'complaints', 'residents', 'rooms', 'staff', 'admissions'];
  const activeTab = validTabs.includes(paramTab) ? (paramTab === 'rooms' ? 'residents' : paramTab) : 'overview';

  const handleSelectTab = (tab, extraParams = {}) => {
    setSearchParams({ tab, ...extraParams });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 🔥 Real-time WebSockets integration for Hostel Incharge Portal
  useEffect(() => {
    if (!socket) return;

    const handleRealtimeUpdate = () => {
      // Invalidate overview metrics, complaints, heatmap, occupancy, staff analytics in real-time
      queryClient.invalidateQueries({ queryKey: ['incharge-overview-complaints'] });
      queryClient.invalidateQueries({ queryKey: ['incharge-overview-occupancy'] });
      queryClient.invalidateQueries({ queryKey: ['incharge-overview-staff'] });
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['complaintAnalytics'] });
      queryClient.invalidateQueries({ queryKey: ['slaBreaches'] });
      queryClient.invalidateQueries({ queryKey: ['kpis'] });
      queryClient.invalidateQueries({ queryKey: ['repeatAnalysis'] });
      queryClient.invalidateQueries({ queryKey: ['drillDownAll'] });
      queryClient.invalidateQueries({ queryKey: ['service-heatmap'] });
      queryClient.invalidateQueries({ queryKey: ['residents-occupancy-all'] });
      queryClient.invalidateQueries({ queryKey: ['staffPerformance'] });
      queryClient.invalidateQueries({ queryKey: ['staff-analytics-overview'] });
      queryClient.invalidateQueries({ queryKey: ['staff-analytics-table'] });
      queryClient.invalidateQueries({ queryKey: ['warden-complaints'] });
    };

    socket.on('complaint:created', handleRealtimeUpdate);
    socket.on('complaint:status-updated', handleRealtimeUpdate);
    socket.on('complaint:assigned', handleRealtimeUpdate);
    socket.on('complaint:deleted', handleRealtimeUpdate);
    socket.on('incident:created', handleRealtimeUpdate);
    socket.on('incident:updated', handleRealtimeUpdate);
    socket.on('service:heatmap-update', handleRealtimeUpdate);
    socket.on('notification:new', handleRealtimeUpdate);

    return () => {
      socket.off('complaint:created', handleRealtimeUpdate);
      socket.off('complaint:status-updated', handleRealtimeUpdate);
      socket.off('complaint:assigned', handleRealtimeUpdate);
      socket.off('complaint:deleted', handleRealtimeUpdate);
      socket.off('incident:created', handleRealtimeUpdate);
      socket.off('incident:updated', handleRealtimeUpdate);
      socket.off('service:heatmap-update', handleRealtimeUpdate);
      socket.off('notification:new', handleRealtimeUpdate);
    };
  }, [socket, queryClient]);

  // Quick summary queries for Overview KPI cards
  const { data: complaintsData } = useQuery({
    queryKey: ['incharge-overview-complaints'],
    queryFn: () => api.get('/complaints/all').then((r) => r.data || []),
    staleTime: 30000,
  });

  const { data: occupancyData } = useQuery({
    queryKey: ['incharge-overview-occupancy'],
    queryFn: () => api.get('/residents/occupancy').then((r) => r.data || {}),
    staleTime: 30000,
  });

  // Derived counts
  const totalComplaints = complaintsData?.length || 0;
  const pendingComplaints = complaintsData?.filter((c) => c.status === 'Pending' || c.status === 'Reopened')?.length || 0;
  const inProgressComplaints = complaintsData?.filter((c) => c.status === 'In Progress')?.length || 0;
  const resolvedComplaints = complaintsData?.filter((c) => c.status === 'Resolved' || c.status === 'resolved')?.length || 0;
  const totalAssignedResidents = occupancyData?.totalAssigned || 0;

  // Handle clicking on Recent Activity options (e.g. last 24h, resolved this month, >48h overdue)
  const handleSelectActivity = (filter) => {
    if (filter?.recent24h) {
      handleSelectTab('complaints', { status: 'all', time: 'today' });
    } else if (filter?.status === 'Resolved' || filter?.thisMonth) {
      handleSelectTab('complaints', { status: 'Resolved', time: 'this_month' });
    } else if (filter?.overdue) {
      handleSelectTab('complaints', { status: 'all', overdue: 'true' });
    } else if (filter?.category) {
      handleSelectTab('complaints', { category: filter.category });
    } else if (filter?.status) {
      handleSelectTab('complaints', { status: filter.status });
    } else {
      handleSelectTab('complaints');
    }
  };

  return (
    <InvestigationProvider>
      <div className="flex min-h-screen w-full bg-canvas text-foreground">
        <HostelSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
        />

        <div className="min-w-0 flex-1">
          <TopBar activeTab={activeTab} onSelectTab={handleSelectTab} />

          <main className="mx-auto max-w-[1680px] px-4 pb-28 pt-6 sm:px-8 lg:px-12">
            {/* 1. COMPLAINTS & HOTSPOTS */}
            {activeTab === 'complaints' && (
              <div className="space-y-12">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="size-5 text-primary" />
                    <span className="text-sm font-semibold">Authoritative 77-Room Spatial Heatmap & Complaint Intelligence</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectTab('overview')}
                    className="text-xs text-primary hover:underline font-medium cursor-pointer"
                  >
                    ← Return to Overview
                  </button>
                </div>

                {/* Spatial Heatmap across 77 rooms */}
                <HeatmapBand />

                {/* Complaint analytics & repeat issues */}
                <ComplaintsBand />

                {/* Direct complaint resolution & triage management */}
                <div className="rounded-2xl border border-border bg-card p-6 shadow-soft space-y-4">
                  <div className="border-b border-border pb-3">
                    <h3 className="text-base font-bold">Operational Complaints & Task Triage</h3>
                    <p className="text-xs text-muted-foreground">Filter by status, category, or time window to manage or reassign complaints in real time.</p>
                  </div>
                  <Suspense fallback={<LoadingFallback message="Loading Complaints Manager..." />}>
                    <WardenComplaints />
                  </Suspense>
                </div>
              </div>
            )}

            {/* 2. RESIDENTS & ROOMS */}
            {activeTab === 'residents' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <UserCheck className="size-5 text-primary" />
                    <span className="text-sm font-semibold">Residents Directory & 77-Room Occupancy (Capacity: Max 2/Room)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectTab('overview')}
                    className="text-xs text-primary hover:underline font-medium cursor-pointer"
                  >
                    ← Return to Overview
                  </button>
                </div>
                <Suspense fallback={<LoadingFallback message="Loading Resident & Room Management..." />}>
                  <ResidentManagement />
                </Suspense>
              </div>
            )}

            {/* 3. STAFF OVERSIGHT */}
            {activeTab === 'staff' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Users className="size-5 text-primary" />
                    <span className="text-sm font-semibold">Staff Workload Oversight & Verified Resolution Attribution</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectTab('overview')}
                    className="text-xs text-primary hover:underline font-medium cursor-pointer"
                  >
                    ← Return to Overview
                  </button>
                </div>
                <Suspense fallback={<LoadingFallback message="Loading Staff Oversight..." />}>
                  <StaffPerformanceAnalytics />
                </Suspense>
              </div>
            )}

            {/* 4. STUDENT ADMISSIONS & ELIGIBILITY */}
            {activeTab === 'admissions' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="size-5 text-primary" />
                    <span className="text-sm font-semibold">Student Admissions, Eligibility & Roster Management</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectTab('overview')}
                    className="text-xs text-primary hover:underline font-medium cursor-pointer"
                  >
                    ← Return to Overview
                  </button>
                </div>
                <Suspense fallback={<LoadingFallback message="Loading Student Admissions & Eligibility..." />}>
                  <StudentAdmissionModule />
                </Suspense>
              </div>
            )}

            {/* 5. OVERVIEW (DEFAULT) */}
            {activeTab === 'overview' && (
              <div className="space-y-16">
                {/* Executive Brief with clickable Recent Activity */}
                <MorningBrief onSelectActivity={handleSelectActivity} />

                {/* Operations Quick Action & Navigation Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <button
                    type="button"
                    onClick={() => handleSelectTab('complaints')}
                    className="flex flex-col items-start p-4 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-soft transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center justify-between w-full mb-3">
                      <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                        <ClipboardList className="size-4.5" />
                      </span>
                      <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-amber-600">Open →</span>
                    </div>
                    <span className="text-xs font-bold text-foreground">Complaints & Hotspots</span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">{pendingComplaints} pending review</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectTab('residents')}
                    className="flex flex-col items-start p-4 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-soft transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center justify-between w-full mb-3">
                      <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <UserCheck className="size-4.5" />
                      </span>
                      <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-blue-600">Open →</span>
                    </div>
                    <span className="text-xs font-bold text-foreground">Residents & Rooms</span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">{totalAssignedResidents} active residents</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectTab('staff')}
                    className="flex flex-col items-start p-4 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-soft transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center justify-between w-full mb-3">
                      <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Users className="size-4.5" />
                      </span>
                      <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-emerald-600">Open →</span>
                    </div>
                    <span className="text-xs font-bold text-foreground">Staff Oversight</span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">Workload & attribution</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectTab('admissions')}
                    className="flex flex-col items-start p-4 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-soft transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center justify-between w-full mb-3">
                      <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <GraduationCap className="size-4.5" />
                      </span>
                      <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-indigo-600">Manage →</span>
                    </div>
                    <span className="text-xs font-bold text-foreground">Student Admissions</span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">Roster & OTP access</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/wifi-dashboard')}
                    className="flex flex-col items-start p-4 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-soft transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center justify-between w-full mb-3">
                      <span className="p-2 rounded-xl bg-violet-500/10 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                        <Wifi className="size-4.5" />
                      </span>
                      <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-violet-600">Portal →</span>
                    </div>
                    <span className="text-xs font-bold text-foreground">Wi-Fi Dashboard</span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">Networking & APs</span>
                  </button>
                </div>

                {/* Real-time Operational KPI Strip */}
                <SignalStrip />

                {/* Complaint & Staff Ownership Band */}
                <div className="space-y-12">
                  <OwnershipBand />
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </InvestigationProvider>
  );
}
