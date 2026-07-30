import React, { useEffect } from 'react';
import { useDrillDown } from '../../hooks/useInchargeDashboard';

const STATUS_COLORS = {
    'Pending':     '#f59e0b',
    'In Progress': '#6366f1',
    'Resolved':    '#10b981',
    'Reopened':    '#f43f5e'
};

export default function DrillDownModal({ filter, title, onClose }) {
    const { data = [], isLoading } = useDrillDown(filter);

    // Close on Escape
    useEffect(() => {
        const handler = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const formatTime = (iso) => {
        if (!iso) return '—';
        return new Date(iso).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="inc-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="inc-modal">
                <div className="inc-modal-header">
                    <div>
                        <h2 className="inc-modal-title">{title}</h2>
                        <p className="inc-modal-sub">{isLoading ? 'Loading…' : `${data.length} complaints`}</p>
                    </div>
                    <button className="inc-modal-close" onClick={onClose}>✕</button>
                </div>

                <div className="inc-modal-body">
                    {isLoading ? (
                        <div className="inc-loader"><div className="inc-spinner"/></div>
                    ) : data.length === 0 ? (
                        <div className="inc-modal-empty">
                            <span>✅</span>
                            <p>No complaints found for this filter.</p>
                        </div>
                    ) : (
                        <div className="inc-modal-table-wrap">
                            <table className="inc-table">
                                <thead>
                                    <tr>
                                        <th>Room</th>
                                        <th>Student</th>
                                        <th>Year / Branch</th>
                                        <th>Category</th>
                                        <th>Description</th>
                                        <th>Status</th>
                                        <th>Assigned To</th>
                                        <th>Time Elapsed</th>
                                        <th>Filed On</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map(c => (
                                        <tr key={c.id}>
                                            <td><strong>{c.room}</strong></td>
                                            <td>
                                                <div>{c.studentName}</div>
                                                <div style={{ color:'#64748b', fontSize:11 }}>{c.rollNumber}</div>
                                            </td>
                                            <td>{c.year} / {c.branch}</td>
                                            <td><span className="inc-badge">{c.category}</span></td>
                                            <td style={{ maxWidth:180, fontSize:12, color:'#94a3b8' }}>{c.description || '—'}</td>
                                            <td>
                                                <span className="inc-tag" style={{
                                                    background: `${STATUS_COLORS[c.status] || '#94a3b8'}20`,
                                                    color: STATUS_COLORS[c.status] || '#94a3b8'
                                                }}>{c.status}</span>
                                            </td>
                                            <td>{c.assignedTo}</td>
                                            <td>
                                                <span style={{ color: c.hoursElapsed > 72 ? '#f43f5e' : c.hoursElapsed > 24 ? '#f59e0b' : '#10b981', fontWeight:700 }}>
                                                    {c.hoursElapsed}h
                                                </span>
                                            </td>
                                            <td style={{ fontSize:11, color:'#64748b', whiteSpace:'nowrap' }}>{formatTime(c.createdAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
