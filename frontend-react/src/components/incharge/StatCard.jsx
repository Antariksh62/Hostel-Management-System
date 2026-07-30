import React from 'react';

const StatCard = ({ icon, label, value, sub, color = '#6366f1', trend, onClick }) => (
    <div
        className={`inc-stat-card${onClick ? ' inc-stat-card--clickable' : ''}`}
        style={{ '--accent': color }}
        onClick={onClick}
        title={onClick ? `Click to view ${label}` : undefined}
    >
        <div className="inc-stat-icon">{icon}</div>
        <div className="inc-stat-body">
            <div className="inc-stat-value">{value ?? '—'}</div>
            <div className="inc-stat-label">{label}</div>
            {sub && <div className="inc-stat-sub">{sub}</div>}
            {trend !== undefined && (
                <div className={`inc-stat-trend ${trend >= 0 ? 'up' : 'down'}`}>
                    {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}% vs last month
                </div>
            )}
            {onClick && <div className="inc-stat-drill-hint">Click to view →</div>}
        </div>
    </div>
);

export default StatCard;
