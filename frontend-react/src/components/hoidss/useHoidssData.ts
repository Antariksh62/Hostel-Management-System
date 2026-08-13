import { useQuery } from '@tanstack/react-query';
import * as api from '../../services/inchargeApi';
import { Health, QueueItem, Recommendation, Signal, Block } from './data';

// Helper for formatting hours
const formatHours = (hours: number) => {
    if (hours < 24) return `${Math.floor(hours)} h`;
    const d = Math.floor(hours / 24);
    const h = Math.floor(hours % 24);
    return `${d} d ${h} h`;
};

// ============================================================================
// Morning Brief
// ============================================================================
export function useMorningBrief() {
    const { data: overview, isLoading: oLoading } = useQuery({ queryKey: ['overview'], queryFn: api.fetchOverview });
    const { data: analytics, isLoading: aLoading } = useQuery({ queryKey: ['complaintAnalytics', 1], queryFn: () => api.fetchComplaintAnalytics(1) });
    const { data: sla, isLoading: sLoading } = useQuery({ queryKey: ['slaBreaches', 48], queryFn: () => api.fetchSLABreaches(48) });
    const { data: predictive, isLoading: pLoading } = useQuery({ queryKey: ['predictive'], queryFn: api.fetchPredictive });
    const { data: kpis, isLoading: kLoading } = useQuery({ queryKey: ['kpis'], queryFn: api.fetchKPIs });

    const isLoading = oLoading || aLoading || sLoading || pLoading || kLoading;

    if (isLoading || !overview || !analytics || !sla || !predictive || !kpis) {
        return { isLoading: true, data: null };
    }

    // Hostel Status
    const healthScore = Math.round((kpis.resolutionRate + (100 - Math.min(100, kpis.unresolvedCount))) / 2);
    let status: "Stable" | "Strained" | "Critical" = "Stable";
    if (healthScore < 60) status = "Critical";
    else if (healthScore < 80) status = "Strained";

    const HOSTEL = {
        name: "PICT Boys Hostel",
        campus: "Pune Institute of Computer Technology",
        shift: `Today · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`,
        status,
        healthScore,
        healthDelta: 0, // Mock delta for now as we don't have historical health score
    };

    // Recent Activity (Last 24h)
    const recentComplaintsCount = analytics.dailyTrend?.length > 0 ? analytics.dailyTrend[analytics.dailyTrend.length - 1].count : 0;
    
    const RECENT_LEDGER = [
        { 
            text: `${recentComplaintsCount} complaints received in the last 24 hours`, 
            filter: { recent24h: true },
            title: "Complaints Received in Last 24 Hours" 
        },
        { 
            text: `${overview.resolvedComplaints || 0} total resolved this month`, 
            emphasis: "ok" as Health,
            filter: { status: "Resolved" },
            title: "Resolved Complaints (This Month)"
        },
    ];
    
    if (sla.count > 0) {
        RECENT_LEDGER.push({ 
            text: `${sla.count} complaints currently overdue (>48h)`, 
            emphasis: "crit" as Health,
            filter: { overdue: true },
            title: "Overdue Complaints (>48h Breach)"
        });
    }

    const highestRising = predictive.trends?.sort((a: any, b: any) => b.changePercent - a.changePercent)[0];
    if (highestRising && highestRising.changePercent > 0) {
        RECENT_LEDGER.push({
            text: `${highestRising.category} complaints rose by ${highestRising.changePercent}% recently`,
            emphasis: "warn" as Health,
            filter: { category: highestRising.category },
            title: `${highestRising.category} Complaints`
        });
    }

    // Brief insight
    let briefStatusText = "Operations are stable.";
    if (sla.count > 0 && highestRising && highestRising.changePercent > 0) {
        briefStatusText = `${highestRising.category} load is increasing, and ${sla.count} complaints are currently overdue.`;
    } else if (sla.count > 0) {
        briefStatusText = `${sla.count} complaints are overdue and require attention.`;
    } else if (highestRising && highestRising.changePercent > 0) {
        briefStatusText = `Operations are generally stable, but ${highestRising.category} complaints are rising.`;
    }

    const AI_BRIEF = [briefStatusText];

    // Priority
    let TODAY_PRIORITY: any = null;
    if (sla.count > 0) {
        const oldest = sla.breaches.sort((a: any, b: any) => b.hoursElapsed - a.hoursElapsed)[0];
        TODAY_PRIORITY = {
            title: `Review overdue ${oldest.category} complaint`,
            detail: `${oldest.description || 'Unresolved issue'} in Room ${oldest.room || 'Unknown'}. Open for ${formatHours(oldest.hoursElapsed)}.`,
            owner: oldest.assignedTo || "Unassigned",
            raw: oldest
        };
    } else if (highestRising && highestRising.changePercent > 10) {
        TODAY_PRIORITY = {
            title: `Investigate ${highestRising.category} increase`,
            detail: `${highestRising.category} complaints have increased by ${highestRising.changePercent}%.`,
            owner: "Management"
        };
    } else {
        TODAY_PRIORITY = {
            title: "No critical priorities",
            detail: "All metrics are within normal operational limits.",
            owner: "—"
        };
    }

    return { isLoading: false, data: { HOSTEL, RECENT_LEDGER, AI_BRIEF, TODAY_PRIORITY } };
}

// ============================================================================
// Signals
// ============================================================================
export function useSignals() {
    const { data: kpis, isLoading: kLoading } = useQuery({ queryKey: ['kpis'], queryFn: api.fetchKPIs });
    const { data: comp, isLoading: cLoading } = useQuery({ queryKey: ['comparison'], queryFn: api.fetchComparison });
    const { data: room, isLoading: rLoading } = useQuery({ queryKey: ['roomAnalytics'], queryFn: api.fetchRoomAnalytics });
    const { data: analytics, isLoading: aLoading } = useQuery({ queryKey: ['complaintAnalytics', 7], queryFn: () => api.fetchComplaintAnalytics(7) });

    const isLoading = kLoading || cLoading || rLoading || aLoading;

    if (isLoading || !kpis || !comp || !room || !analytics) {
        return { isLoading: true, data: null };
    }

    const sparkline = analytics.dailyTrend?.map((d: any) => d.count) || [0,0,0,0,0,0,0];

    const SIGNALS: Signal[] = [
        {
            id: "occupancy",
            label: "Occupancy",
            value: `${room.occupancyRate}%`,
            delta: "—",
            deltaDir: "flat",
            health: "ok",
            consequence: "Hostel occupancy rate.",
            action: null,
            series: [room.occupancyRate, room.occupancyRate], // Flat sparkline for occupancy
        },
        {
            id: "complaints",
            label: "Complaint Health",
            value: `${kpis.unresolvedCount} open`,
            delta: `${comp.deltas.pending > 0 ? '+' : ''}${comp.deltas.pending}%`,
            deltaDir: comp.deltas.pending > 0 ? "up" : comp.deltas.pending < 0 ? "down" : "flat",
            health: kpis.unresolvedCount > 20 ? "warn" : "ok",
            consequence: `${comp.deltas.pending > 0 ? 'Increase' : 'Decrease'} in pending complaints vs last month.`,
            action: "View Complaints",
            series: sparkline,
        },
        {
            id: "resolutionRate",
            label: "Resolution Rate",
            value: `${kpis.resolutionRate}%`,
            delta: `${comp.deltas.resolved > 0 ? '+' : ''}${comp.deltas.resolved}%`,
            deltaDir: comp.deltas.resolved > 0 ? "up" : comp.deltas.resolved < 0 ? "down" : "flat",
            health: kpis.resolutionRate >= 80 ? "ok" : kpis.resolutionRate >= 60 ? "warn" : "crit",
            consequence: "Percentage of total complaints resolved.",
            action: null,
            series: [kpis.resolutionRate, kpis.resolutionRate],
        },
        {
            id: "avgResolution",
            label: "Avg Resolution Time",
            value: formatHours(kpis.avgResolutionHours),
            delta: "—",
            deltaDir: "flat",
            health: kpis.avgResolutionHours <= 24 ? "ok" : kpis.avgResolutionHours <= 48 ? "warn" : "crit",
            consequence: "Average time taken to resolve a complaint.",
            action: null,
            series: [kpis.avgResolutionHours, kpis.avgResolutionHours],
        },
        {
            id: "efficiency",
            label: "Staff Efficiency",
            value: `${kpis.efficiencyScore}/100`,
            delta: "—",
            deltaDir: "flat",
            health: kpis.efficiencyScore >= 80 ? "ok" : kpis.efficiencyScore >= 60 ? "warn" : "crit",
            consequence: "Aggregate score based on resolution speed and rate.",
            action: null,
            series: [kpis.efficiencyScore, kpis.efficiencyScore],
        },
        {
            id: "satisfaction",
            label: "Student Satisfaction",
            value: `${kpis.satisfactionScore || 'N/A'}`,
            delta: "—",
            deltaDir: "flat",
            health: (kpis.satisfactionScore || 0) >= 4 ? "ok" : "warn",
            consequence: "Average rating from resolved complaints.",
            action: null,
            series: [kpis.satisfactionScore || 0, kpis.satisfactionScore || 0],
        }
    ];

    return { isLoading: false, data: { SIGNALS } };
}

// ============================================================================
// Heatmap
// ============================================================================
export function useHeatmap() {
    const { data: heatmapData, isLoading: hLoading } = useQuery({ queryKey: ['heatmap'], queryFn: api.fetchHeatmap });
    const { data: repeatData, isLoading: rLoading } = useQuery({ queryKey: ['repeatAnalysis'], queryFn: api.fetchRepeatAnalysis });

    const isLoading = hLoading || rLoading;

    if (isLoading || !heatmapData || !repeatData) {
        return { isLoading: true, data: null };
    }

    // Build map of complaints per room from backend heatmapData
    const roomComplaintMap = new Map<string, { total: number; topCategory?: string }>();
    if (heatmapData.floors) {
        heatmapData.floors.forEach((f: any) => {
            (f.rooms || []).forEach((r: any) => {
                roomComplaintMap.set(String(r.room), {
                    total: r.total || 0,
                    topCategory: r.topCategory
                });
            });
        });
    }

    // Define fixed 5 floors and 90 rooms
    const floorConfigs = [
        { floor: 1, label: "1st Floor", range: [101, 120] },
        { floor: 2, label: "2nd Floor", range: [201, 220] },
        { floor: 3, label: "3rd Floor", range: [301, 320] },
        { floor: 4, label: "4th Floor", range: [401, 420] },
        { floor: 5, label: "5th Floor", range: [501, 510] }
    ];

    const BLOCKS: Block[] = floorConfigs.map((cfg) => {
        const rooms = [];

        for (let rNum = cfg.range[0]; rNum <= cfg.range[1]; rNum++) {
            const rId = String(rNum);
            const dataForRoom = roomComplaintMap.get(rId) || { total: 0 };
            const healthScore = dataForRoom.total === 0 ? 100 : Math.max(10, 100 - (dataForRoom.total * 15));

            rooms.push({
                id: rId,
                score: healthScore,
                complaints: dataForRoom.total,
                types: dataForRoom.topCategory ? [dataForRoom.topCategory] : [],
                occupant: "Occupied",
                inspection: 100,
                infra: healthScore,
                cost: "N/A",
                lastRepair: "N/A"
            });
        }

        const blockScore = Math.round(rooms.reduce((acc, r) => acc + r.score, 0) / rooms.length);

        return {
            id: `F${cfg.floor}`,
            name: cfg.label,
            score: blockScore,
            health: blockScore >= 80 ? "ok" : blockScore >= 65 ? "warn" : "crit",
            floors: [
                {
                    id: `F${cfg.floor}-main`,
                    name: "All Rooms",
                    score: blockScore,
                    rooms
                }
            ]
        };
    });

    const PROBLEM_ROOMS = (repeatData.byRoomCategory || []).slice(0, 5).map((r: any) => ({
        room: r.room,
        complaints: r.count,
        category: r.category,
        cost: "N/A",
        score: Math.max(10, 100 - (r.count * 15))
    }));

    return { isLoading: false, data: { BLOCKS, PROBLEM_ROOMS } };
}

// ============================================================================
// Complaints
// ============================================================================
export function useComplaints() {
    const { data: analytics, isLoading: aLoading } = useQuery({ queryKey: ['complaintAnalytics', 30], queryFn: () => api.fetchComplaintAnalytics(30) });
    const { data: predictive, isLoading: pLoading } = useQuery({ queryKey: ['predictive'], queryFn: api.fetchPredictive });
    const { data: repeat, isLoading: rLoading } = useQuery({ queryKey: ['repeatAnalysis'], queryFn: api.fetchRepeatAnalysis });
    const { data: overview, isLoading: oLoading } = useQuery({ queryKey: ['overview'], queryFn: api.fetchOverview });
    // Fetch recent complaints to calculate aging
    const { data: drilldown, isLoading: dLoading } = useQuery({ queryKey: ['drillDownAll'], queryFn: () => api.fetchDrillDown({ limit: 100, status: 'Pending' }) });

    const isLoading = aLoading || pLoading || rLoading || oLoading || dLoading;

    if (isLoading || !analytics || !predictive || !repeat || !overview || !drilldown) {
        return { isLoading: true, data: null };
    }

    const CATEGORIES = (analytics.byCategory || []).map((c: any) => {
        const catName = c.name || c._id || "General";
        const pred = predictive.trends?.find((p: any) => p.category === catName);
        const growth = pred ? pred.changePercent : 0;
        return {
            name: catName,
            count: c.count,
            growth: `${growth > 0 ? '+' : ''}${growth}%`,
            health: growth > 20 ? "crit" : growth > 0 ? "warn" : "ok" as Health
        };
    }).sort((a: any, b: any) => b.count - a.count);

    const COMPLAINT_TREND = (analytics.dailyTrend || []).map((d: any) => ({
        day: d.date,
        all: d.count,
        // UI expects 'electrical' but we can just map the top category dynamically if needed, 
        // for now mapping it to the first category to keep UI working
        electrical: Math.round(d.count * 0.4) // Mocked electrical share for the trend line if actual daily-by-category is unavailable
    }));

    // Calculate aging buckets
    let b0_8 = 0, b8_24 = 0, b1_3d = 0, b3_7d = 0, b7d_plus = 0;
    drilldown.forEach((c: any) => {
        if (c.hoursElapsed <= 8) b0_8++;
        else if (c.hoursElapsed <= 24) b8_24++;
        else if (c.hoursElapsed <= 72) b1_3d++;
        else if (c.hoursElapsed <= 168) b3_7d++;
        else b7d_plus++;
    });

    const AGING = [
        { bucket: "0–8 h", count: b0_8, health: "ok" as Health },
        { bucket: "8–24 h", count: b8_24, health: "ok" as Health },
        { bucket: "1–3 d", count: b1_3d, health: "warn" as Health },
        { bucket: "3–7 d", count: b3_7d, health: "warn" as Health },
        { bucket: "7 d+", count: b7d_plus, health: "crit" as Health },
    ];

    const REPEAT_STATS = [
        { label: "Repeat complaints", value: `${(repeat.byRoomCategory || []).length}`, note: "Rooms with multiple identical issues" },
        { label: "Avg Resolution", value: formatHours(overview.avgResolutionHours || 0), note: "Across all categories" },
        { label: "Total Open", value: `${(overview.pendingComplaints || 0) + (overview.inProgressComplaints || 0)}`, note: "Currently unresolved" },
    ];
    
    // Dynamic Verdict
    const topCat = CATEGORIES[0];
    let verdict = `No active complaints.`;
    if (topCat && topCat.name) {
        const share = Math.round((topCat.count / (CATEGORIES.reduce((acc: number, c: any) => acc + c.count, 0) || 1)) * 100);
        verdict = `${topCat.name} accounts for ${share}% of recent complaints — trend is ${topCat.growth} vs last month.`;
    }

    return { isLoading: false, data: { CATEGORIES, COMPLAINT_TREND, AGING, REPEAT_STATS, verdict } };
}

// ============================================================================
// Ownership / Staff
// ============================================================================
export function useOwnership() {
    const { data: sla, isLoading: sLoading } = useQuery({ queryKey: ['slaBreaches', 48], queryFn: () => api.fetchSLABreaches(48) });
    const { data: staffData, isLoading: stLoading } = useQuery({ queryKey: ['staffPerformance'], queryFn: api.fetchStaffPerformance });

    const isLoading = sLoading || stLoading;

    if (isLoading || !sla || !staffData) {
        return { isLoading: true, data: null };
    }

    const QUEUE: QueueItem[] = sla.breaches.map((b: any, i: number) => ({
        id: b.id || `q${i}`,
        kind: "SLA breach",
        title: b.description || `${b.category} issue`,
        location: `Room ${b.room}`,
        block: b.room ? `Floor ${b.room.charAt(0)}` : "Unknown",
        category: b.category,
        severity: b.urgencyLevel === "CRITICAL" ? "crit" : b.urgencyLevel === "HIGH" ? "warn" : "ok",
        age: `Open ${formatHours(b.hoursElapsed)}`,
        owner: b.assignedTo,
        slaIn: "Breached",
    }));

    let maxLoad = 1;
    staffData.forEach((s: any) => { if (s.pending > maxLoad) maxLoad = s.pending; });

    const STAFF = staffData.map((s: any) => ({
        name: s.name,
        role: s.role || "Staff",
        load: Math.round((s.pending / maxLoad) * 100),
        open: s.pending,
        response: "—", // Not tracked in HMS
        resolution: formatHours(s.avgResolutionHours),
        sla: Math.round(s.efficiencyScore),
        availability: s.pending > 0 ? "Busy" : "Idle",
        health: s.pending > maxLoad * 0.8 && maxLoad > 5 ? "crit" : s.pending > maxLoad * 0.5 ? "warn" : "ok" as Health
    }));
    
    // Dynamic Verdict
    let verdict = "Workload is balanced and queues are empty.";
    if (QUEUE.length > 0) {
        verdict = `${QUEUE.length} complaints have breached the 48h SLA.`;
        if (STAFF.length > 1 && STAFF[0].open > (STAFF[STAFF.length-1].open * 2) && STAFF[0].open > 5) {
            verdict += ` Workload is uneven — ${STAFF[0].name} holds significantly more open jobs than others.`;
        }
    }

    return { isLoading: false, data: { QUEUE, STAFF, verdict } };
}

// ============================================================================
// Mission Control
// ============================================================================
export function useMissionControl() {
    const { data: predictive, isLoading: pLoading } = useQuery({ queryKey: ['predictive'], queryFn: api.fetchPredictive });
    const { data: sla, isLoading: sLoading } = useQuery({ queryKey: ['slaBreaches', 48], queryFn: () => api.fetchSLABreaches(48) });
    const { data: staffData, isLoading: stLoading } = useQuery({ queryKey: ['staffPerformance'], queryFn: api.fetchStaffPerformance });

    const isLoading = pLoading || sLoading || stLoading;

    if (isLoading || !predictive || !sla || !staffData) {
        return { isLoading: true, data: null };
    }

    const RECOMMENDATIONS: Recommendation[] = [];
    let idCounter = 1;

    // Rule A: Rising Category
    const rising = (predictive.trends || []).filter((p: any) => p.changePercent > 20).sort((a: any, b: any) => b.changePercent - a.changePercent);
    if (rising.length > 0) {
        RECOMMENDATIONS.push({
            id: `rec${idCounter++}`,
            title: `Review ${rising[0].category} complaints`,
            urgency: "High",
            why: `${rising[0].category} complaints have increased by ${rising[0].changePercent}% compared to last month.`,
            evidence: [
                `${rising[0].recentCount ?? rising[0].currentCount ?? 0} complaints this month vs ${rising[0].olderCount ?? rising[0].prevCount ?? 0} last month`
            ],
            confidence: 0, // Removed per instructions
            impact: "Identify underlying cause of spike",
            money: "—",
            action: "Investigate Trend",
            evidenceTarget: "forecast",
            scope: { category: rising[0].category }
        });
    }

    // Rule B: SLA Breaches
    if (sla.count > 0) {
        RECOMMENDATIONS.push({
            id: `rec${idCounter++}`,
            title: "Escalate overdue complaints",
            urgency: "Critical",
            why: `${sla.count} complaints have remained unresolved for more than 48 hours.`,
            evidence: [
                `Oldest complaint open for ${formatHours(sla.breaches[0]?.hoursElapsed || 0)}`
            ],
            confidence: 0,
            impact: "Ensure student issues are resolved",
            money: "—",
            action: "Review Queue",
            evidenceTarget: "queue"
        });
    }

    // Rule C: Staff Imbalance
    if (staffData.length >= 2) {
        const sortedStaff = [...staffData].sort((a: any, b: any) => b.pending - a.pending);
        const top = sortedStaff[0];
        const bottom = sortedStaff[sortedStaff.length - 1];
        
        if (top.pending > 5 && top.pending > bottom.pending * 2) {
            RECOMMENDATIONS.push({
                id: `rec${idCounter++}`,
                title: "Review workload distribution",
                urgency: "Medium",
                why: "Staff workload is meaningfully unbalanced.",
                evidence: [
                    `${top.name} has ${top.pending} open jobs`,
                    `${bottom.name} has ${bottom.pending} open jobs`
                ],
                confidence: 0,
                impact: "Improve overall resolution speed",
                money: "—",
                action: "Reassign Jobs",
                evidenceTarget: "queue"
            });
        }
    }

    // Ensure max 3
    const finalRecs = RECOMMENDATIONS.slice(0, 3);
    
    // Add default if empty
    if (finalRecs.length === 0) {
        finalRecs.push({
            id: "rec_default",
            title: "Operations are normal",
            urgency: "Medium",
            why: "No significant anomalies detected in recent data.",
            evidence: ["Metrics within normal limits"],
            confidence: 0,
            impact: "—",
            money: "—",
            action: "View Overview",
            evidenceTarget: "complaints"
        });
    }

    return { isLoading: false, data: { RECOMMENDATIONS: finalRecs } };
}

// ============================================================================
// Forecast
// ============================================================================
export function useForecast() {
    const { data: trend, isLoading: tLoading } = useQuery({ queryKey: ['monthlyTrend'], queryFn: api.fetchMonthlyTrend });
    const { data: comp, isLoading: cLoading } = useQuery({ queryKey: ['comparison'], queryFn: api.fetchComparison });
    const { data: predictive, isLoading: pLoading } = useQuery({ queryKey: ['predictive'], queryFn: api.fetchPredictive });
    const { data: analytics, isLoading: aLoading } = useQuery({ queryKey: ['complaintAnalytics', 14], queryFn: () => api.fetchComplaintAnalytics(14) });

    const isLoading = tLoading || cLoading || pLoading || aLoading;

    if (isLoading || !trend || !comp || !predictive || !analytics) {
        return { isLoading: true, data: null };
    }

    const FORECAST = [
        {
            id: "f1",
            label: "Total Complaints (This Month)",
            value: comp.current.total,
            note: `${comp.deltas.total > 0 ? '+' : ''}${comp.deltas.total}% vs last month`,
            inaction: comp.deltas.total > 0 ? "Increasing volume" : "Decreasing volume",
            confidence: 0,
        },
        {
            id: "f2",
            label: "Resolved (This Month)",
            value: comp.current.resolved,
            note: `${comp.deltas.resolved > 0 ? '+' : ''}${comp.deltas.resolved}% vs last month`,
            inaction: comp.deltas.resolved < 0 ? "Resolution rate dropping" : "Resolution stable",
            confidence: 0,
        },
        {
            id: "f3",
            label: "Pending (Current)",
            value: comp.current.pending,
            note: `${comp.deltas.pending > 0 ? '+' : ''}${comp.deltas.pending}% vs last month`,
            inaction: comp.deltas.pending > 0 ? "Backlog growing" : "Backlog shrinking",
            confidence: 0,
        }
    ];

    // Build simple extrapolation for FORECAST_SERIES (14 days past + 7 days future)
    const FORECAST_SERIES: any[] = [];
    if (analytics.dailyTrend && analytics.dailyTrend.length > 0) {
        const last14 = analytics.dailyTrend.slice(-14);
        let sum = 0;
        last14.forEach((d: any) => {
            sum += d.count;
            FORECAST_SERIES.push({
                day: d.date,
                actual: d.count,
                low: d.count,
                high: d.count
            });
        });
        
        // Simple average daily
        const avg = Math.round(sum / last14.length);
        const lastDateStr = last14[last14.length - 1].date;
        const lastDate = new Date(`${lastDateStr}T00:00:00`);
        
        for (let i = 1; i <= 7; i++) {
            const nextDate = new Date(lastDate);
            nextDate.setDate(lastDate.getDate() + i);
            const dateStr = nextDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            FORECAST_SERIES.push({
                day: dateStr,
                actual: null,
                low: Math.max(0, avg - 2),
                high: avg + 2
            });
        }
    }

    const MONTHLY_SPEND = trend.map((t: any) => ({
        month: t.month,
        spend: t.created, // Reusing existing chart format to show Created vs Resolved instead of money
        budget: t.resolved
    }));

    // Re-purpose ASSETS to show category trends instead of fake assets
    const ASSETS = (predictive.trends || []).map((p: any) => ({
        asset: p.category,
        repairs: p.currentCount,
        failure: p.prevCount, // Actually "Previous Month"
        cost: `${p.changePercent > 0 ? '+' : ''}${p.changePercent}%`, // Actually "Growth"
        verdict: p.trend === "RISING" ? "Rising" : p.trend === "FALLING" ? "Falling" : "Stable"
    })).sort((a: any, b: any) => b.repairs - a.repairs);

    let verdict = `Complaint volume is ${comp.deltas.total > 0 ? 'rising' : 'falling'} by ${Math.abs(comp.deltas.total)}% compared to last month.`;

    return { isLoading: false, data: { FORECAST, FORECAST_SERIES, MONTHLY_SPEND, ASSETS, verdict } };
}
