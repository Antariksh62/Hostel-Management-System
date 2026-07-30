import React from 'react';
import { useKanban } from '../../hooks/useInchargeDashboard';

const COLS = [
    { key: 'Pending',     label: 'Pending',     color: '#f59e0b', icon: '⏳', bg: '#f59e0b08' },
    { key: 'In Progress', label: 'In Progress',  color: '#6366f1', icon: '🔄', bg: '#6366f108' },
    { key: 'Reopened',    label: 'Reopened',     color: '#f43f5e', icon: '🔁', bg: '#f43f5e08' },
    { key: 'Resolved',    label: 'Resolved',     color: '#10b981', icon: '✅', bg: '#10b98108' },
];

const Loader = () => <div className="inc-loader"><div className="inc-spinner"/></div>;
const Err = ({ msg, onRetry }) => (
    <div className="inc-err">⚠ {msg || 'Failed to load'}
        {onRetry && <button className="inc-retry-btn" onClick={onRetry}>↺ Retry</button>}
    </div>
);

function timeAgo(iso) {
    const h = Math.round((Date.now() - new Date(iso)) / (1000*60*60));
    if (h < 1) return 'Just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.round(h/24)}d ago`;
}

function KanbanCard({ c, color }) {
    const urgencyColor =
        c.hoursElapsed > 72 ? '#f43f5e' :
        c.hoursElapsed > 24 ? '#f59e0b' : '#10b981';

    return (
        <div className="inc-kanban-card" style={{ borderLeftColor: color }}>
            <div className="inc-kanban-card-top">
                <span className="inc-badge">{c.category}</span>
                <span className="inc-kanban-elapsed" style={{ color: urgencyColor }}>
                    {c.hoursElapsed}h
                </span>
            </div>
            {c.description && (
                <div className="inc-kanban-desc">{c.description}</div>
            )}
            <div className="inc-kanban-meta">
                <span title="Room">🏠 {c.room}</span>
                <span title="Student">👤 {c.studentName}</span>
            </div>
            <div className="inc-kanban-footer">
                <span className="inc-kanban-assign">→ {c.assignedTo}</span>
                <span className="inc-kanban-time">{timeAgo(c.createdAt)}</span>
            </div>
        </div>
    );
}

export default function KanbanBoard({ dateRange = {} }) {
    const { data: board, isLoading, error, refetch } = useKanban(dateRange);

    if (isLoading) return <Loader/>;
    if (error)     return <Err msg={error.message} onRetry={refetch}/>;

    const grandTotal = COLS.reduce((s, col) => s + (board?.[col.key]?.total || 0), 0);

    return (
        <div>
            <div className="inc-section-title">
                📋 Complaint Pipeline
                {grandTotal > 0 && (
                    <span style={{ marginLeft: 10, fontSize: 12, color: '#64748b', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                        {grandTotal} total
                    </span>
                )}
                {(dateRange.from || dateRange.to) && (
                    <span style={{ marginLeft: 10, fontSize: 11, color: '#6366f1', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
                        📅 {dateRange.from || '…'} → {dateRange.to || 'now'}
                    </span>
                )}
            </div>

            <div className="inc-kanban">
                {COLS.map(col => {
                    const colData = board?.[col.key] || { complaints: [], total: 0 };
                    const overflow = colData.total - colData.complaints.length;

                    return (
                        <div key={col.key} className="inc-kanban-col" style={{ background: col.bg }}>
                            {/* Column header */}
                            <div className="inc-kanban-col-header" style={{ borderBottomColor: col.color + '40' }}>
                                <div className="inc-kanban-col-title">
                                    <span>{col.icon}</span>
                                    <span style={{ color: col.color }}>{col.label}</span>
                                </div>
                                <span
                                    className="inc-kanban-col-count"
                                    style={{ background: col.color + '20', color: col.color }}
                                >
                                    {colData.total}
                                </span>
                            </div>

                            {/* Cards */}
                            <div className="inc-kanban-cards">
                                {colData.complaints.length === 0 ? (
                                    <div className="inc-kanban-empty">No complaints</div>
                                ) : (
                                    colData.complaints.map(c => (
                                        <KanbanCard key={String(c.id)} c={c} color={col.color}/>
                                    ))
                                )}
                                {overflow > 0 && (
                                    <div className="inc-kanban-more" style={{ color: col.color }}>
                                        +{overflow} more
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
