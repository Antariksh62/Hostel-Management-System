import React from 'react';
import { fmtDateTime } from '../utils/dateUtils';

// ─── Per-status visual config ─────────────────────────────────────────────────
const STATUS_CONFIG = {
    Pending:     { color: '#d97706', bg: '#fef3c7', border: '#fde68a', icon: '⏳', label: 'Raised'       },
    'In Progress':{ color: '#7c3aed', bg: '#ede9fe', border: '#c4b5fd', icon: '🔧', label: 'In Progress'  },
    Resolved:    { color: '#059669', bg: '#d1fae5', border: '#6ee7b7', icon: '✅', label: 'Resolved'     },
    Reopened:    { color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', icon: '🔁', label: 'Reopened'     },
};

const DEFAULT_CONFIG = { color: '#6b7280', bg: '#f3f4f6', border: '#e5e7eb', icon: '📋', label: 'Update' };

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * ComplaintTimeline
 *
 * Props:
 *   complaint  – the full complaint object (needs statusHistory, createdAt,
 *                assignedTo, assignedAt, resolvedAt, feedback)
 *   compact    – if true, renders a condensed version (no bg card, smaller text)
 */
const ComplaintTimeline = ({ complaint, compact = false }) => {
    if (!complaint) return null;

    // Build a unified list of timeline events from statusHistory (preferred)
    // OR fall back to synthesising events from legacy fields.
    let events = [];

    if (complaint.statusHistory && complaint.statusHistory.length > 0) {
        events = complaint.statusHistory.map(e => ({
            status:    e.status,
            timestamp: e.timestamp,
            note:      e.note || '',
        }));
    } else {
        // ── Legacy fallback ──────────────────────────────────────────────────
        // Older complaints in DB won't have statusHistory. Synthesise from
        // existing scalar fields so they still get a timeline.
        events.push({
            status:    'Pending',
            timestamp: complaint.createdAt,
            note:      'Complaint raised by student',
        });
        if (complaint.assignedTo) {
            events.push({
                status:    'In Progress',
                timestamp: complaint.assignedAt || complaint.updatedAt,
                note:      `Assigned to ${complaint.assignedTo?.name || 'staff'}`,
            });
        }
        if (complaint.status === 'Resolved' || complaint.resolvedAt) {
            events.push({
                status:    'Resolved',
                timestamp: complaint.resolvedAt || complaint.updatedAt,
                note:      'Marked as resolved',
            });
        }
        if (complaint.status === 'Reopened') {
            events.push({
                status:    'Reopened',
                timestamp: complaint.feedback?.submittedAt || complaint.updatedAt,
                note:      'Student marked complaint as NOT resolved',
            });
        }
    }

    if (events.length === 0) return null;

    // ── Render ───────────────────────────────────────────────────────────────
    const wrapStyle = compact
        ? { marginTop: '0.75rem' }
        : {
            marginTop:    '1rem',
            padding:      '0.9rem 1rem',
            borderRadius: 10,
            background:   '#f8fafc',
            border:       '1px solid #e2e8f0',
          };

    return (
        <div style={wrapStyle}>
            {!compact && (
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em', marginBottom: '0.65rem', textTransform: 'uppercase' }}>
                    Complaint Timeline
                </p>
            )}
            <div style={{ position: 'relative' }}>
                {/* Vertical connector line */}
                {events.length > 1 && (
                    <div style={{
                        position:   'absolute',
                        left:       15,
                        top:        22,
                        bottom:     10,
                        width:      2,
                        background: 'linear-gradient(to bottom, #cbd5e1, #e2e8f0)',
                        borderRadius: 2,
                    }} />
                )}

                {events.map((ev, idx) => {
                    const cfg       = STATUS_CONFIG[ev.status] || DEFAULT_CONFIG;
                    const isLast    = idx === events.length - 1;
                    const isFirst   = idx === 0;

                    return (
                        <div key={idx} style={{
                            display:       'flex',
                            alignItems:    'flex-start',
                            gap:           '0.7rem',
                            marginBottom:  isLast ? 0 : '0.85rem',
                            position:      'relative',
                        }}>
                            {/* Icon bubble */}
                            <div style={{
                                width:       30,
                                height:      30,
                                borderRadius: '50%',
                                background:  cfg.bg,
                                border:      `2px solid ${cfg.border}`,
                                display:     'flex',
                                alignItems:  'center',
                                justifyContent: 'center',
                                fontSize:    isFirst ? '0.9rem' : '0.8rem',
                                flexShrink:  0,
                                zIndex:      1,
                                boxShadow:   isLast ? `0 0 0 3px ${cfg.bg}` : 'none',
                            }}>
                                {cfg.icon}
                            </div>

                            {/* Text */}
                            <div style={{ flex: 1, paddingTop: 3 }}>
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                                    <span style={{
                                        fontSize:    compact ? '0.75rem' : '0.78rem',
                                        fontWeight:  700,
                                        color:       cfg.color,
                                    }}>
                                        {isFirst ? '🆕 Raised' : cfg.label}
                                    </span>
                                    {ev.note && (
                                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                            — {ev.note}
                                        </span>
                                    )}
                                </div>
                                <span style={{
                                    fontSize:    compact ? '0.7rem' : '0.73rem',
                                    color:       '#94a3b8',
                                    fontVariantNumeric: 'tabular-nums',
                                    display:     'block',
                                    marginTop:   2,
                                }}>
                                    {fmtDateTime(ev.timestamp)}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ComplaintTimeline;
