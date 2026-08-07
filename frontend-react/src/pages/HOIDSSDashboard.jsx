import { useState } from 'react';

import { ComplaintsBand } from '@/components/hoidss/complaints';
import { InvestigationProvider } from '@/components/hoidss/context';
import { InvestigationDrawer } from '@/components/hoidss/drawer';
import { ForecastBand } from '@/components/hoidss/forecast';
import { HeatmapBand } from '@/components/hoidss/heatmap';
import { MissionControl } from '@/components/hoidss/mission-control';
import { MorningBrief } from '@/components/hoidss/morning-brief';
import { OwnershipBand } from '@/components/hoidss/ownership';
import { HostelSidebar, TopBar } from '@/components/hoidss/shell';
import { SignalStrip } from '@/components/hoidss/signals';

export default function HOIDSSDashboard() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <InvestigationProvider>
      <div className="flex min-h-screen w-full bg-canvas dark">
        <HostelSidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

        <div className="min-w-0 flex-1">
          <TopBar />

          <main className="mx-auto max-w-[1440px] px-5 pb-24 pt-10 sm:px-8">
            <div className="space-y-14">
              <MorningBrief />
              <SignalStrip />

              <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="order-2 space-y-14 xl:order-1">
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

        <InvestigationDrawer />
      </div>
    </InvestigationProvider>
  );
}
