import React, { useState } from 'react';

const CATEGORY_COLORS = {
    Electrical:  '#f59e0b',
    Plumbing:    '#22d3ee',
    Furniture:   '#a78bfa',
    Cleanliness: '#10b981',
    Internet:    '#6366f1',
    Other:       '#94a3b8'
};

// Interpolate between dark-blue → yellow → red based on intensity 0–1
function intensityToColor(pct) {
    if (pct === 0) return '#0f172a';
    if (pct < 0.25) return '#1e3a5f';
    if (pct < 0.5)  return '#1d4ed8';
    if (pct < 0.75) return '#f59e0b';
    return '#ef4444';
}

export default function HeatmapGrid({ floors = [], maxComplaints = 1 }) {
    const [tooltip, setTooltip] = useState(null);
    const [floorFilter, setFloorFilter] = useState('all');

    const visibleFloors = floorFilter === 'all'
        ? floors
        : floors.filter(f => f.floor === floorFilter);

    if (!floors.length) {
        return (
            <div className="inc-heatmap-empty">
                🏠 No complaint data with room numbers yet.<br/>
                <span>Rooms will appear here once students submit complaints.</span>
            </div>
        );
    }

    return (
        <div className="inc-heatmap-wrap">
            {/* Floor filter */}
            <div className="inc-filter-row" style={{ marginBottom: 16 }}>
                <span className="inc-filter-label">Floor:</span>
                <button className={`inc-range-btn ${floorFilter==='all'?'active':''}`} onClick={() => setFloorFilter('all')}>All</button>
                {floors.map(f => (
                    <button key={f.floor} className={`inc-range-btn ${floorFilter===f.floor?'active':''}`}
                        onClick={() => setFloorFilter(f.floor)}>
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Legend */}
            <div className="inc-heatmap-legend">
                <span className="inc-heatmap-legend-label">Low</span>
                {['#1e3a5f','#1d4ed8','#f59e0b','#ef4444'].map((c,i) => (
                    <div key={i} className="inc-heatmap-legend-swatch" style={{ background: c }}/>
                ))}
                <span className="inc-heatmap-legend-label">High</span>
                <span className="inc-heatmap-legend-divider"/>
                <span className="inc-heatmap-legend-label">No complaints:</span>
                <div className="inc-heatmap-legend-swatch" style={{ background:'#0f172a', border:'1px solid #334155' }}/>
            </div>

            {/* Floors */}
            {visibleFloors.map(floor => (
                <div key={floor.floor} className="inc-heatmap-floor">
                    <div className="inc-heatmap-floor-header">
                        <span className="inc-heatmap-floor-label">{floor.label}</span>
                        <span className="inc-heatmap-floor-count">{floor.totalComplaints} complaint{floor.totalComplaints !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="inc-heatmap-grid">
                        {floor.rooms.map(room => {
                            const pct = room.total / maxComplaints;
                            const bg  = intensityToColor(pct);
                            return (
                                <div
                                    key={room.room}
                                    className="inc-heatmap-cell"
                                    style={{ background: bg }}
                                    onMouseEnter={e => setTooltip({ room, x: e.clientX, y: e.clientY })}
                                    onMouseLeave={() => setTooltip(null)}
                                    onMouseMove={e => tooltip && setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }))}
                                >
                                    <div className="inc-heatmap-cell-room">{room.room}</div>
                                    <div className="inc-heatmap-cell-count">{room.total}</div>
                                    {room.topCategory && (
                                        <div className="inc-heatmap-cell-dot"
                                            style={{ background: CATEGORY_COLORS[room.topCategory] || '#94a3b8' }}/>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}

            {/* Tooltip */}
            {tooltip && (
                <div className="inc-heatmap-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}>
                    <div className="inc-heatmap-tt-room">Room {tooltip.room.room}</div>
                    <div className="inc-heatmap-tt-row"><span>Total:</span><strong>{tooltip.room.total}</strong></div>
                    <div className="inc-heatmap-tt-row"><span>Pending:</span><strong style={{color:'#f59e0b'}}>{tooltip.room.pending}</strong></div>
                    <div className="inc-heatmap-tt-row"><span>In Progress:</span><strong style={{color:'#6366f1'}}>{tooltip.room.inProgress}</strong></div>
                    <div className="inc-heatmap-tt-row"><span>Resolved:</span><strong style={{color:'#10b981'}}>{tooltip.room.resolved}</strong></div>
                    {tooltip.room.topCategory && (
                        <div className="inc-heatmap-tt-row">
                            <span>Top Issue:</span>
                            <strong style={{color: CATEGORY_COLORS[tooltip.room.topCategory] || '#94a3b8'}}>
                                {tooltip.room.topCategory}
                            </strong>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
