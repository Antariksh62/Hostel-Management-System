// ─── Export Utilities (no external deps) ─────────────────────────────────────

/**
 * Download data as a CSV file
 * @param {Array<Object>} rows  - array of flat objects
 * @param {string}        filename
 */
export function exportCSV(rows, filename = 'report.csv') {
    if (!rows || !rows.length) return;
    const headers = Object.keys(rows[0]);
    const escape  = v => {
        const s = String(v ?? '');
        return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"`
            : s;
    };
    const csv = [
        headers.join(','),
        ...rows.map(r => headers.map(h => escape(r[h])).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Print the dashboard as a PDF via browser print dialog
 * (styled via @media print in InchargeDashboard.css)
 */
export function exportPDF() {
    window.print();
}

// ─── Pre-shaped export functions per section ──────────────────────────────────

export function exportComplaintsCSV(byCategory = []) {
    exportCSV(
        byCategory.map((c, i) => ({
            Rank:     i + 1,
            Category: c.name,
            Count:    c.count,
            Share:    `${c.percent}%`
        })),
        `complaint-categories-${today()}.csv`
    );
}

export function exportStaffCSV(staff = []) {
    exportCSV(
        staff.map((s, i) => ({
            Rank:               i + 1,
            Name:               s.name,
            Email:              s.email,
            Assigned:           s.assigned,
            Resolved:           s.resolved,
            Pending:            s.pending,
            'Resolution Rate':  `${s.resolutionRate}%`,
            'Avg Time (hrs)':   s.avgResolutionHours ?? 'N/A',
            'Efficiency Score': s.efficiencyScore
        })),
        `staff-performance-${today()}.csv`
    );
}

export function exportRoomsCSV(roomDetails = []) {
    exportCSV(
        roomDetails.map(r => ({
            Room:          r.roomNumber,
            Capacity:      r.capacity,
            Occupants:     r.occupants,
            Utilization:   `${r.utilization}%`,
            Complaints:    r.complaintCount
        })),
        `room-analytics-${today()}.csv`
    );
}

export function exportRepeatCSV(data = []) {
    exportCSV(
        data.map(r => ({
            Room:             r.room,
            Category:         r.category,
            Occurrences:      r.count,
            'Suggested Action': r.suggestion
        })),
        `repeat-complaints-${today()}.csv`
    );
}

export function exportMaintenanceCSV(data = []) {
    exportCSV(
        data.map(m => ({
            Category:           m.category,
            'Total Complaints':  m.totalComplaints,
            'Pending':          m.pendingComplaints,
            'Avg Resolution(h)': m.avgResolutionHours ?? 'N/A',
            'Health Score':     `${m.maintenanceScore}%`
        })),
        `maintenance-${today()}.csv`
    );
}

export function exportMonthlyCSV(data = []) {
    exportCSV(
        data.map(m => ({
            Month:    m.label,
            Created:  m.created,
            Resolved: m.resolved
        })),
        `monthly-trend-${today()}.csv`
    );
}

function today() {
    return new Date().toISOString().split('T')[0];
}
