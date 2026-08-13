/**
 * InchargeDashboard.jsx
 *
 * Route:    /incharge-dashboard  (and /headwarden-dashboard)
 * Roles:    INCHARGE, HEADWARDEN
 * Auth:     Handled by PrivateRoute in App.jsx — unchanged.
 *
 * Visual implementation replaced with the HOIDSS Lovable dashboard.
 * All mock data lives in @/components/hoidss/data — no backend calls yet.
 *
 * TODO (next phase): replace static data constants in
 *   src/components/hoidss/data.ts  with real API calls from
 *   src/services/inchargeApi.js
 */

import { useState } from 'react';

import { ComplaintsBand } from '@/components/hoidss/complaints';
import { InvestigationProvider } from '@/components/hoidss/context';
import { InvestigationDrawer, DrilldownListSheet } from '@/components/hoidss/drawer';
import { ForecastBand } from '@/components/hoidss/forecast';
import { HeatmapBand } from '@/components/hoidss/heatmap';
import { MissionControl } from '@/components/hoidss/mission-control';
import { MorningBrief } from '@/components/hoidss/morning-brief';
import { OwnershipBand } from '@/components/hoidss/ownership';
import { HostelSidebar, TopBar } from '@/components/hoidss/shell';
import { SignalStrip } from '@/components/hoidss/signals';

export default function InchargeDashboard() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <InvestigationProvider>
      <div className="flex min-h-screen w-full bg-canvas text-foreground">
        <HostelSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        <div className="min-w-0 flex-1">
          <TopBar />

          <main className="mx-auto max-w-[1680px] px-8 pb-44 pt-10 sm:px-12 lg:px-16">
            <div className="space-y-24 lg:space-y-32">
              <MorningBrief />
              <SignalStrip />

              <div className="grid gap-12 xl:gap-16 xl:grid-cols-[minmax(0,1fr)_420px]">
                {/*
                 * Left column: spatial heatmap → complaint intelligence → ownership queue
                 * Right column: mission control (sticky AI recommendations panel)
                 * The `order-*` classes ensure mission control leads on mobile where
                 * decisions matter more than evidence.
                 */}
                <div className="order-2 space-y-24 lg:space-y-32 xl:order-1">
                  <HeatmapBand />
                  <ComplaintsBand />
                  <OwnershipBand />
                </div>
                <div className="order-1 xl:order-2">
                  <MissionControl />
                </div>
              </div>

              <ForecastBand />
            </div>
          </main>
        </div>

        {/* Slide-out investigation detail drawer */}
        <InvestigationDrawer />
        <DrilldownListSheet />
      </div>
    </InvestigationProvider>
  );
}
