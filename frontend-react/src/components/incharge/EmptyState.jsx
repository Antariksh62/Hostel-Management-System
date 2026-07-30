import React from 'react';

const ICONS = {
    complaints: '📋',
    staff:      '👷',
    rooms:      '🏠',
    students:   '🎓',
    insights:   '🔮',
    default:    '📊'
};

export default function EmptyState({ type = 'default', title, subtitle }) {
    const icon = ICONS[type] || ICONS.default;
    const defaultTitle = `No ${type} data yet`;
    const defaultSub   = 'Data will appear here once the system has activity.';

    return (
        <div className="inc-empty-state">
            <div className="inc-empty-icon">{icon}</div>
            <div className="inc-empty-title">{title || defaultTitle}</div>
            <div className="inc-empty-sub">{subtitle || defaultSub}</div>
        </div>
    );
}
