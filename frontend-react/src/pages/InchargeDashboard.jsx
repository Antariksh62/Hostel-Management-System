import React, { useState, useContext, useCallback, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import {
    useOverview, useComplaintAnalytics, useStaffPerformance,
    useWardenPerformance, useRoomAnalytics, useStudentAnalytics,
    useRepeatAnalysis, useKPIs, usePredictive, useMaintenance,
    useHeatmap, useStudentComplaintCorrelation, useMonthlyTrend, useRefreshAll,
    useSLABreaches, useComparison, useTopComplainers
} from '../hooks/useInchargeDashboard';
import StatCard from '../components/incharge/StatCard';
import {
    TrendChart, CategoryBar, StatusDonut, DistributionPie, StaffBar, WeeklyBar, MonthlyChart
} from '../components/incharge/Charts';
import HeatmapGrid from '../components/incharge/HeatmapGrid';
import DrillDownModal from '../components/incharge/DrillDownModal';
import AnnouncementBoard from '../components/incharge/AnnouncementBoard';
import KanbanBoard from '../components/incharge/KanbanBoard';
import {
    exportComplaintsCSV, exportStaffCSV, exportRoomsCSV,
    exportRepeatCSV, exportMaintenanceCSV, exportMonthlyCSV, exportPDF
} from '../utils/exportUtils';
import './InchargeDashboard.css';

const TABS = ['Overview','Complaints','Staff','Rooms','Students','Insights','Pipeline','Notices'];

const Loader = () => <div className="inc-loader"><div className="inc-spinner"/></div>;
const Err = ({ msg, onRetry }) => (
    <div className="inc-err">
        ⚠ {msg || 'Failed to load'}
        {onRetry && <button className="inc-retry-btn" onClick={onRetry}>↺ Retry</button>}
    </div>
);

/* ── KPI Score Ring ── */
const Ring = ({ value, label, color }) => {
    const r = 36, c = 2*Math.PI*r, pct = Math.min(100, value ?? 0);
    return (
        <div className="inc-ring-wrap">
            <svg width="90" height="90" viewBox="0 0 90 90">
                <circle cx="45" cy="45" r={r} fill="none" stroke="#1e293b" strokeWidth="8"/>
                <circle cx="45" cy="45" r={r} fill="none" stroke={color} strokeWidth="8"
                    strokeDasharray={c} strokeDashoffset={c - (pct/100)*c}
                    strokeLinecap="round" transform="rotate(-90 45 45)"/>
                <text x="45" y="50" textAnchor="middle" fill="#f1f5f9" fontSize="14" fontWeight="bold">
                    {value != null ? `${value}%` : '—'}
                </text>
            </svg>
            <div className="inc-ring-label">{label}</div>
        </div>
    );
};

/* ── Funnel ── */
const Funnel = ({ data }) => {
    const steps = [
        { label:'Created',     val: data?.created,    color:'#6366f1' },
        { label:'Assigned',    val: data?.assigned,   color:'#22d3ee' },
        { label:'In Progress', val: data?.inProgress, color:'#f59e0b' },
        { label:'Resolved',    val: data?.resolved,   color:'#10b981' },
    ];
    const max = steps[0]?.val || 1;
    return (
        <div className="inc-funnel">
            {steps.map((s,i) => (
                <div key={i} className="inc-funnel-step">
                    <div className="inc-funnel-bar-wrap">
                        <div className="inc-funnel-bar" style={{
                            width:`${Math.round((s.val||0)/max*100)}%`,
                            background: s.color
                        }}/>
                    </div>
                    <div className="inc-funnel-meta">
                        <span style={{ color: s.color }}>{s.label}</span>
                        <span className="inc-funnel-count">{s.val ?? 0}</span>
                    </div>
                    {i < steps.length-1 && <div className="inc-funnel-arrow">↓</div>}
                </div>
            ))}
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   TAB: OVERVIEW
══════════════════════════════════════════════════════════ */
const OverviewTab = ({ onDrillDown, slaHours }) => {
    const { data: ov, isLoading, error } = useOverview();
    const { data: kpi } = useKPIs();
    const { data: cmp } = useComparison();
    const { data: sla } = useSLABreaches(slaHours);
    if (isLoading) return <Loader/>;
    if (error) return <Err msg={error.message}/>;
    return (
        <div>
            {/* Executive Cards */}
            <div className="inc-section-title">👥 People & Rooms</div>
            <div className="inc-grid-4">
                <StatCard icon="🎓" label="Total Students"  value={ov?.students}     color="#6366f1"/>
                <StatCard icon="🔧" label="Total Staff"     value={ov?.staff}        color="#22d3ee"/>
                <StatCard icon="🛡" label="Wardens"         value={ov?.wardens}      color="#f59e0b"/>
                <StatCard icon="🏠" label="Total Rooms"     value={ov?.totalRooms}   color="#10b981"/>
                <StatCard icon="✅" label="Occupied Rooms"  value={ov?.occupiedRooms} color="#10b981"/>
                <StatCard icon="⬜" label="Vacant Rooms"   value={ov?.vacantRooms}  color="#94a3b8"/>
                <StatCard icon="👑" label="Head Wardens"    value={ov?.headWardens}  color="#a78bfa"/>
            </div>

            <div className="inc-section-title">📋 Complaint Summary</div>
            <div className="inc-grid-4">
                <StatCard icon="📊" label="Total Complaints" value={ov?.totalComplaints}    color="#6366f1" trend={cmp?.deltas?.total}    onClick={() => onDrillDown({}, 'All Complaints')}/>
                <StatCard icon="🔴" label="Active"           value={ov?.activeComplaints}   color="#f43f5e" trend={cmp?.deltas?.inProg}   onClick={() => onDrillDown({ status:'In Progress' }, 'Active Complaints')}/>
                <StatCard icon="🟡" label="Pending"          value={ov?.pendingComplaints}  color="#f59e0b" trend={cmp?.deltas?.pending}  onClick={() => onDrillDown({ status:'Pending' }, 'Pending Complaints')}/>
                <StatCard icon="🟢" label="Resolved"         value={ov?.resolvedComplaints} color="#10b981" trend={cmp?.deltas?.resolved} onClick={() => onDrillDown({ status:'Resolved' }, 'Resolved Complaints')}/>
                <StatCard icon="📅" label="This Week"        value={ov?.complaintsThisWeek}  color="#22d3ee"/>
                <StatCard icon="📆" label="This Month"       value={ov?.complaintsThisMonth} color="#6366f1"/>
                <StatCard icon="⚡" label="High Priority"    value={ov?.highPriorityIssues}  color="#f43f5e" onClick={() => onDrillDown({ category:'Electrical' }, 'Electrical Complaints')}/>
                <StatCard icon="🔁" label="Repeat Issues"    value={ov?.repeatComplaints}    color="#f59e0b"/>
            </div>

            {/* SLA Breach Alert */}
            {(sla?.count ?? 0) > 0 && (
                <div className="inc-sla-alert">
                    <div className="inc-sla-alert-icon">⚠️</div>
                    <div>
                        <div className="inc-sla-alert-title">{sla.count} SLA Breach{sla.count > 1 ? 'es' : ''} — Complaints pending over {sla.slaHours}h</div>
                        <div className="inc-sla-alert-sub">These complaints need immediate attention</div>
                    </div>
                    <button className="inc-sla-view-btn" onClick={() => onDrillDown({ status:'Pending' }, `SLA Breaches (${sla.count})`)}>View All →</button>
                </div>
            )}

            <div className="inc-section-title">⏱ Resolution Metrics</div>
            <div className="inc-grid-4">
                <StatCard icon="📈" label="Resolution Rate" value={`${ov?.resolutionRate ?? 0}%`} color="#10b981"/>
                <StatCard icon="⏰" label="Avg Resolution"  value={ov?.avgResolutionHours ? `${ov.avgResolutionHours}h` : '—'} color="#6366f1"/>
                <StatCard icon="⚡" label="Fastest"         value={ov?.fastestResolution} color="#22d3ee"/>
                <StatCard icon="🐢" label="Slowest"         value={ov?.slowestResolution} color="#f59e0b"/>
            </div>

            {/* KPI Rings */}
            {kpi && (
                <>
                    <div className="inc-section-title">🎯 Operational KPIs</div>
                    <div className="inc-kpi-rings">
                        <Ring value={kpi.resolutionRate}    label="Resolution Rate"    color="#10b981"/>
                        <Ring value={kpi.efficiencyScore}   label="Efficiency Score"   color="#6366f1"/>
                        <Ring value={kpi.satisfactionScore} label="Satisfaction Score" color="#22d3ee"/>
                        <Ring value={kpi.roomHealthScore}   label="Room Health"        color="#f59e0b"/>
                    </div>
                </>
            )}
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   TAB: COMPLAINTS
══════════════════════════════════════════════════════════ */
const ComplaintsTab = ({ days, setDays, dateRange }) => {
    const { data, isLoading, error, refetch } = useComplaintAnalytics(days, dateRange);
    const { data: monthly, isLoading: ml } = useMonthlyTrend();
    if (isLoading) return <Loader/>;
    if (error) return <Err msg={error.message} onRetry={refetch}/>;
    return (
        <div>
            <div className="inc-filter-row">
                <span className="inc-filter-label">Time Range:</span>
                {[7,14,30,60,90].map(d => (
                    <button key={d} className={`inc-range-btn ${days===d&&!dateRange?.from?'active':''}`} onClick={() => setDays(d)}>{d}d</button>
                ))}
                {dateRange?.from && <span className="inc-date-active-badge">📅 Custom range active</span>}
                <button className="inc-export-btn" onClick={() => exportComplaintsCSV(data?.byCategory)}>⬇ Export CSV</button>
                <button className="inc-export-btn" onClick={() => exportMonthlyCSV(monthly || [])}>⬇ Monthly CSV</button>
                <button className="inc-export-btn" onClick={exportPDF}>🖨 Print PDF</button>
            </div>

            <div className="inc-section-title">📅 12-Month Trend (Created vs Resolved)</div>
            {ml ? <Loader/> : <MonthlyChart data={monthly || []} title="Monthly Complaint Volume"/>}

            <div className="inc-section-title">📊 Daily &amp; Weekly Trends</div>
            <div className="inc-grid-2">
                <TrendChart data={data?.dailyTrend}  title="Daily Complaints"/>
                <WeeklyBar  data={data?.weeklyTrend} title="Weekly Complaints"/>
            </div>

            <div className="inc-section-title">📂 By Category &amp; Status</div>
            <div className="inc-grid-2">
                <CategoryBar  data={data?.byCategory} title="Complaints by Category"/>
                <StatusDonut  data={data?.byStatus}   title="Status Breakdown"/>
            </div>

            <div className="inc-section-title">🔽 Resolution Funnel</div>
            <div className="inc-funnel-card">
                <h3 className="inc-chart-title">Complaint Lifecycle Funnel</h3>
                <Funnel data={data?.funnel}/>
            </div>

            <div className="inc-section-title">🏆 Most Frequent Issues</div>
            <div className="inc-table-wrap">
                <table className="inc-table">
                    <thead>
                        <tr><th>#</th><th>Category</th><th>Count</th><th>Share</th><th>Trend Bar</th></tr>
                    </thead>
                    <tbody>
                        {(data?.byCategory || []).map((c,i) => (
                            <tr key={c.name}>
                                <td>{i+1}</td>
                                <td><span className="inc-badge">{c.name}</span></td>
                                <td><strong>{c.count}</strong></td>
                                <td>{c.percent}%</td>
                                <td>
                                    <div className="inc-mini-bar">
                                        <div style={{ width:`${c.percent}%`, background:'#6366f1' }}/>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   TAB: STAFF & WARDENS
══════════════════════════════════════════════════════════ */
const StaffTab = () => {
    const { data: staff,  isLoading: sl, error: se } = useStaffPerformance();
    const { data: warden, isLoading: wl, error: we } = useWardenPerformance();
    if (sl || wl) return <Loader/>;
    if (se) return <Err msg={se.message}/>;
    if (we) return <Err msg={we.message}/>;

    // Workload Balance — flag anyone with >1.5x average assignments
    const avgAssigned = staff?.length ? Math.round((staff.reduce((s,m) => s + (m.assigned||0), 0)) / staff.length) : 0;
    const overloaded  = (staff||[]).filter(m => m.assigned > avgAssigned * 1.5);

    return (
        <div>
            <div className="inc-filter-row" style={{ marginBottom: 16 }}>
                <button className="inc-export-btn" onClick={() => exportStaffCSV(staff || [])}>⬇ Export Staff CSV</button>
            </div>

            {overloaded.length > 0 && (
                <div className="inc-sla-alert" style={{ borderColor:'#f59e0b60', background:'#f59e0b08' }}>
                    <div className="inc-sla-alert-icon">⚡</div>
                    <div>
                        <div className="inc-sla-alert-title">Workload Imbalance Detected</div>
                        <div className="inc-sla-alert-sub">{overloaded.map(m => m.name).join(', ')} ha{overloaded.length>1?'ve':'s'} over 1.5× the average ({avgAssigned}) assignments. Consider redistributing tasks.</div>
                    </div>
                </div>
            )}

            <div className="inc-section-title">👷 Staff Performance</div>
            <StaffBar data={staff || []} title="Resolution Rate by Staff Member"/>

            <div className="inc-table-wrap">
                <table className="inc-table">
                    <thead>
                        <tr>
                            <th>Rank</th><th>Name</th><th>Assigned</th><th>Resolved</th>
                            <th>Pending</th><th>Rate</th><th>Avg Time</th><th>Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(staff || []).map((s,i) => (
                            <tr key={s.id}>
                                <td>
                                    <span className={`inc-rank rank-${i+1}`}>#{i+1}</span>
                                </td>
                                <td>{s.name}</td>
                                <td>{s.assigned}</td>
                                <td><span className="inc-tag green">{s.resolved}</span></td>
                                <td><span className="inc-tag yellow">{s.pending}</span></td>
                                <td>
                                    <div className="inc-mini-bar">
                                        <div style={{ width:`${s.resolutionRate}%`, background: s.resolutionRate>70?'#10b981':'#f59e0b' }}/>
                                    </div>
                                    <span>{s.resolutionRate}%</span>
                                </td>
                                <td>{s.avgResolutionHours ? `${s.avgResolutionHours}h` : '—'}</td>
                                <td><span className="inc-score">{s.efficiencyScore}</span></td>
                            </tr>
                        ))}
                        {(!staff || staff.length === 0) && (
                            <tr><td colSpan="8" style={{ textAlign:'center', color:'#94a3b8' }}>No staff data</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="inc-section-title">🛡 Warden Overview</div>
            <div className="inc-table-wrap">
                <table className="inc-table">
                    <thead>
                        <tr><th>Name</th><th>Role</th><th>Assigned (Tenure)</th><th>Resolved</th><th>Escalated</th><th>Success Rate</th><th>Avg Assign Time</th></tr>
                    </thead>
                    <tbody>
                        {(warden || []).map(w => (
                            <tr key={w.id}>
                                <td>{w.name}</td>
                                <td><span className="inc-badge">{w.role}</span></td>
                                <td>{w.complaintsAssigned}</td>
                                <td><span className="inc-tag green">{w.resolvedInTenure}</span></td>
                                <td><span className="inc-tag red">{w.escalatedComplaints}</span></td>
                                <td>{w.resolutionSuccessRate}%</td>
                                <td>{w.avgAssignmentHours ? `${w.avgAssignmentHours}h` : '—'}</td>
                            </tr>
                        ))}
                        {(!warden || warden.length === 0) && (
                            <tr><td colSpan="7" style={{ textAlign:'center', color:'#94a3b8' }}>No warden data</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   TAB: ROOMS
══════════════════════════════════════════════════════════ */
const RoomsTab = ({ dateRange }) => {
    const { data, isLoading, error, refetch } = useRoomAnalytics();
    const { data: heatmap, isLoading: hl } = useHeatmap(dateRange);
    if (isLoading) return <Loader/>;
    if (error) return <Err msg={error.message} onRetry={refetch}/>;
    return (
        <div>
            <div className="inc-grid-4" style={{ marginBottom: 24 }}>
                <StatCard icon="🏠" label="Total Rooms"    value={data?.totalRooms}    color="#6366f1"/>
                <StatCard icon="✅" label="Occupied"       value={data?.occupiedRooms} color="#10b981"/>
                <StatCard icon="⬜" label="Vacant"         value={data?.vacantRooms}   color="#94a3b8"/>
                <StatCard icon="📊" label="Occupancy Rate" value={`${data?.occupancyRate ?? 0}%`} color="#22d3ee"/>
            </div>

            <div className="inc-filter-row" style={{ marginBottom: 8 }}>
                <button className="inc-export-btn" onClick={() => exportRoomsCSV(data?.roomDetails || [])}>⬇ Export Rooms CSV</button>
            </div>

            <div className="inc-section-title">🔥 Complaint Heatmap by Floor & Room</div>
            <div className="inc-chart-box" style={{ marginBottom: 24 }}>
                {hl ? <Loader/> : <HeatmapGrid floors={heatmap?.floors || []} maxComplaints={heatmap?.maxComplaints || 1}/>}
            </div>

            <div className="inc-section-title">📋 Top Complaint Rooms</div>
            <div className="inc-table-wrap">
                <table className="inc-table">
                    <thead>
                        <tr><th>#</th><th>Room</th><th>Complaints</th><th>Bar</th></tr>
                    </thead>
                    <tbody>
                        {(data?.topComplaintRooms || []).map((r,i) => {
                            const max = data.topComplaintRooms[0]?.count || 1;
                            return (
                                <tr key={r._id}>
                                    <td>{i+1}</td>
                                    <td><strong>{r._id || 'Unassigned'}</strong></td>
                                    <td><span className="inc-tag red">{r.count}</span></td>
                                    <td>
                                        <div className="inc-mini-bar">
                                            <div style={{ width:`${Math.round(r.count/max*100)}%`, background:'#f43f5e' }}/>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="inc-section-title">🔁 Repeat Issue Rooms</div>
            <div className="inc-grid-3">
                {(data?.repeatIssueRooms || []).map((r,i) => (
                    <div key={i} className="inc-repeat-card">
                        <div className="inc-repeat-room">Room {r.room || '—'}</div>
                        <div className="inc-repeat-cat">{r.category}</div>
                        <div className="inc-repeat-count">{r.count}x reported</div>
                    </div>
                ))}
                {(!data?.repeatIssueRooms || data.repeatIssueRooms.length === 0) && (
                    <div style={{ color:'#94a3b8', gridColumn:'1/-1' }}>No repeat issues detected ✅</div>
                )}
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   TAB: STUDENTS
══════════════════════════════════════════════════════════ */
const StudentsTab = () => {
    const { data, isLoading, error, refetch } = useStudentAnalytics();
    const { data: corr, isLoading: cl } = useStudentComplaintCorrelation();
    const { data: top,  isLoading: tl } = useTopComplainers();
    if (isLoading) return <Loader/>;
    if (error) return <Err msg={error.message} onRetry={refetch}/>;
    return (
        <div>
            <div className="inc-grid-4" style={{ marginBottom: 24 }}>
                <StatCard icon="🎓" label="Total Students" value={data?.total} color="#6366f1"/>
            </div>
            <div className="inc-section-title">📊 Student Distribution</div>
            <div className="inc-grid-2">
                <DistributionPie data={data?.byYear   || []} title="By Year"/>
                <DistributionPie data={data?.byBranch || []} title="By Branch"/>
            </div>

            <div className="inc-section-title">🔗 Student Complaint Correlation</div>
            {cl ? <Loader/> : (
                <div className="inc-grid-2">
                    <CategoryBar data={(corr?.byBranch||[]).map(r=>({name:r._id||'Unknown',count:r.count}))} title="Complaints by Branch"/>
                    <CategoryBar data={(corr?.byYear||[]).map(r=>({name:r._id||'Unknown',count:r.count}))} title="Complaints by Year"/>
                </div>
            )}
            <div className="inc-grid-2">
                <div className="inc-table-wrap">
                    <table className="inc-table">
                        <thead><tr><th>Year</th><th>Count</th></tr></thead>
                        <tbody>
                            {(data?.byYear || []).map(r => (
                                <tr key={r._id}><td>{r._id || '—'}</td><td>{r.count}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="inc-table-wrap">
                    <table className="inc-table">
                        <thead><tr><th>Branch</th><th>Count</th></tr></thead>
                        <tbody>
                            {(data?.byBranch || []).map(r => (
                                <tr key={r._id}><td>{r._id || '—'}</td><td>{r.count}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="inc-section-title">🔥 Top Repeat Complainers</div>
            {tl ? <Loader/> : (
                <div className="inc-table-wrap">
                    <table className="inc-table">
                        <thead><tr><th>#</th><th>Name</th><th>Roll</th><th>Room</th><th>Year/Branch</th><th>Total</th><th>Unresolved</th><th>Top Issue</th></tr></thead>
                        <tbody>
                            {(top||[]).length === 0 ? (
                                <tr><td colSpan="8" style={{textAlign:'center',color:'#94a3b8'}}>No complaint data yet</td></tr>
                            ) : (top||[]).map((s,i) => (
                                <tr key={s.studentId}>
                                    <td><span className={`inc-rank rank-${i+1}`}>#{i+1}</span></td>
                                    <td><strong>{s.name}</strong></td>
                                    <td style={{color:'#64748b',fontSize:12}}>{s.rollNumber}</td>
                                    <td>{s.room}</td>
                                    <td>{s.year} / {s.branch}</td>
                                    <td><strong>{s.count}</strong></td>
                                    <td><span className="inc-tag red">{s.unresolved}</span></td>
                                    <td><span className="inc-badge">{s.topCategory||'—'}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   TAB: INSIGHTS (Predictive + Maintenance + Repeat)
══════════════════════════════════════════════════════════ */
const InsightsTab = () => {
    const { data: pred, isLoading: pl, error: pe } = usePredictive();
    const { data: maint, isLoading: ml, error: me } = useMaintenance();
    const { data: rep,   isLoading: rl, error: re } = useRepeatAnalysis();
    if (pl || ml || rl) return <Loader/>;
    if (pe || me || re) return <Err msg={(pe || me || re)?.message}/>;

    return (
        <div>
            <div className="inc-filter-row" style={{ marginBottom: 16 }}>
                <button className="inc-export-btn" onClick={() => exportMaintenanceCSV(maint || [])}>⬇ Maintenance CSV</button>
                <button className="inc-export-btn" onClick={() => exportRepeatCSV(rep?.byRoomCategory || [])}>⬇ Repeats CSV</button>
            </div>
            <div className="inc-section-title">🔮 Predictive Insights</div>
            {(pred?.recommendations || []).length === 0
                ? <p style={{ color:'#94a3b8' }}>Not enough data for predictions yet.</p>
                : (pred?.recommendations || []).map((r,i) => (
                    <div key={i} className={`inc-insight-card urgency-${r.urgency?.toLowerCase()}`}>
                        <div className="inc-insight-header">
                            <span className="inc-badge">{r.category}</span>
                            <span className={`inc-urgency ${r.urgency?.toLowerCase()}`}>{r.urgency}</span>
                        </div>
                        <p className="inc-insight-text">{r.insight}</p>
                        <p className="inc-insight-action">💡 {r.action}</p>
                    </div>
                ))
            }

            <div className="inc-section-title">📈 Category Trends (30 vs 60 days)</div>
            <div className="inc-table-wrap">
                <table className="inc-table">
                    <thead>
                        <tr><th>Category</th><th>Last 30d</th><th>Prior 30d</th><th>Change</th></tr>
                    </thead>
                    <tbody>
                        {(pred?.trends || []).map(t => (
                            <tr key={t.category}>
                                <td>{t.category}</td>
                                <td>{t.recentCount}</td>
                                <td>{t.olderCount}</td>
                                <td>
                                    <span className={`inc-change ${t.changePercent > 0 ? 'up' : 'down'}`}>
                                        {t.changePercent > 0 ? '▲' : '▼'} {Math.abs(t.changePercent)}%
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="inc-section-title">🔧 Maintenance Insights</div>
            <div className="inc-table-wrap">
                <table className="inc-table">
                    <thead>
                        <tr><th>Category</th><th>Total</th><th>Pending</th><th>Avg Resolution</th><th>Health</th></tr>
                    </thead>
                    <tbody>
                        {(maint || []).map(m => (
                            <tr key={m.category}>
                                <td><span className="inc-badge">{m.category}</span></td>
                                <td>{m.totalComplaints}</td>
                                <td><span className="inc-tag yellow">{m.pendingComplaints}</span></td>
                                <td>{m.avgResolutionHours ? `${m.avgResolutionHours}h` : '—'}</td>
                                <td>
                                    <div className="inc-health-bar">
                                        <div style={{ width:`${m.maintenanceScore}%`,
                                            background: m.maintenanceScore>70?'#10b981':m.maintenanceScore>40?'#f59e0b':'#f43f5e' }}/>
                                    </div>
                                    <span>{m.maintenanceScore}%</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="inc-section-title">🔁 Repeat Complaint Analysis</div>
            <div className="inc-table-wrap">
                <table className="inc-table">
                    <thead>
                        <tr><th>Room</th><th>Category</th><th>Occurrences</th><th>Suggested Action</th></tr>
                    </thead>
                    <tbody>
                        {(rep?.byRoomCategory || []).map((r,i) => (
                            <tr key={i}>
                                <td><strong>{r.room || '—'}</strong></td>
                                <td><span className="inc-badge">{r.category}</span></td>
                                <td><span className="inc-tag red">{r.count}x</span></td>
                                <td style={{ color:'#94a3b8', fontSize:13 }}>{r.suggestion}</td>
                            </tr>
                        ))}
                        {(!rep?.byRoomCategory || rep.byRoomCategory.length === 0) && (
                            <tr><td colSpan="4" style={{ textAlign:'center', color:'#94a3b8' }}>No repeat complaints detected ✅</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

/* ══════════════════════════════════════════════════════════
   MAIN DASHBOARD
══════════════════════════════════════════════════════════ */
export default function InchargeDashboard() {
    const { user, logout }  = useContext(AuthContext);
    const [tab, setTab]     = useState('Overview');
    const [days, setDays]   = useState(30);
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [slaHours, setSlaHours]   = useState(48);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [modal, setModal] = useState(null);
    const refreshAll = useRefreshAll();
    const intervalRef = useRef(null);

    const handleRefresh = useCallback(() => {
        refreshAll();
        setLastUpdated(new Date());
    }, [refreshAll]);

    // Auto-refresh every 5 minutes
    useEffect(() => {
        if (autoRefresh) {
            intervalRef.current = setInterval(() => {
                refreshAll();
                setLastUpdated(new Date());
            }, 5 * 60 * 1000);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [autoRefresh, refreshAll]);

    const openDrillDown = useCallback((filter, title) => setModal({ filter, title }), []);
    const closeModal    = useCallback(() => setModal(null), []);

    const roleLabel = user?.role === 'HEADWARDEN' ? 'HEAD WARDEN' : 'HOSTEL INCHARGE';

    const TAB_ICONS = { Overview:'📊', Complaints:'📋', Staff:'👷', Rooms:'🏠', Students:'🎓', Insights:'🔮', Pipeline:'🗂', Notices:'📢' };

    const hasDateFilter = !!(dateRange.from || dateRange.to);
    const clearDateRange = () => setDateRange({ from: '', to: '' });

    return (
        <div className="inc-root">
            {/* Drill-Down Modal */}
            {modal && <DrillDownModal filter={modal.filter} title={modal.title} onClose={closeModal}/>}

            {/* Sidebar */}
            <aside className="inc-sidebar">
                <div className="inc-logo">
                    <span className="inc-logo-icon">🏛</span>
                    <div>
                        <div className="inc-logo-title">Hostel Command</div>
                        <div className="inc-logo-sub">Management Dashboard</div>
                    </div>
                </div>
                <nav className="inc-nav">
                    {TABS.map(t => (
                        <button key={t} className={`inc-nav-btn ${tab===t?'active':''}`} onClick={() => setTab(t)}>
                            {TAB_ICONS[t]}
                            <span>{t}</span>
                        </button>
                    ))}
                </nav>
                <div className="inc-sidebar-footer">
                    <div className="inc-user-info">
                        <div className="inc-avatar">{user?.name?.[0]?.toUpperCase() || 'I'}</div>
                        <div>
                            <div className="inc-user-name">{user?.name || 'Incharge'}</div>
                            <div className="inc-user-role">{roleLabel}</div>
                        </div>
                    </div>
                    <button className="inc-logout" onClick={logout}>⇠ Logout</button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="inc-main">
                <div className="inc-topbar">
                    <div>
                        <h1 className="inc-page-title">{tab}</h1>
                        <p className="inc-page-sub">Management Master Dashboard · {new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
                    </div>
                    <div className="inc-topbar-right">
                        {/* Date Range Picker */}
                        <div className="inc-date-range">
                            <span className="inc-filter-label" style={{ fontSize:11 }}>📅</span>
                            <input
                                type="date" value={dateRange.from}
                                onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))}
                                className="inc-date-input" title="From date"
                            />
                            <span style={{ color:'#475569', fontSize:12 }}>→</span>
                            <input
                                type="date" value={dateRange.to}
                                onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))}
                                className="inc-date-input" title="To date"
                                min={dateRange.from || undefined}
                            />
                            {hasDateFilter && (
                                <button className="inc-date-clear" onClick={clearDateRange} title="Clear date filter">✕</button>
                            )}
                        </div>
                        {/* SLA Threshold */}
                        <div className="inc-sla-ctrl" title="SLA breach threshold">
                            <span style={{ fontSize:11, color:'#64748b' }}>SLA</span>
                            <select
                                value={slaHours}
                                onChange={e => setSlaHours(Number(e.target.value))}
                                className="inc-sla-select"
                            >
                                <option value={12}>12h</option>
                                <option value={24}>24h</option>
                                <option value={48}>48h</option>
                                <option value={72}>72h</option>
                                <option value={96}>96h</option>
                            </select>
                        </div>
                        <span className="inc-last-updated">Updated {lastUpdated.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</span>
                        <label className="inc-autorefresh-label" title="Auto-refresh every 5 minutes">
                            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} style={{ accentColor:'#6366f1' }}/>
                            Auto
                        </label>
                        <button className="inc-refresh-btn" onClick={handleRefresh} title="Refresh now">↺ Refresh</button>
                        <button className="inc-export-btn" onClick={exportPDF} title="Print as PDF">🖨 PDF</button>
                        <div className="inc-live-dot"/>
                        <span style={{ color:'#94a3b8', fontSize:13 }}>Live</span>
                    </div>
                </div>

                <div className="inc-content">
                    {tab === 'Overview'    && <OverviewTab onDrillDown={openDrillDown} slaHours={slaHours}/>}
                    {tab === 'Complaints'  && <ComplaintsTab days={days} setDays={setDays} dateRange={dateRange}/>}
                    {tab === 'Staff'       && <StaffTab/>}
                    {tab === 'Rooms'       && <RoomsTab dateRange={dateRange}/>}
                    {tab === 'Students'    && <StudentsTab/>}
                    {tab === 'Insights'    && <InsightsTab/>}
                    {tab === 'Pipeline'    && (
                        <div>
                            <KanbanBoard dateRange={dateRange}/>
                        </div>
                    )}
                    {tab === 'Notices'     && (
                        <div className="inc-chart-box" style={{ padding: 24 }}>
                            <AnnouncementBoard/>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
