import React, { useState } from 'react';
import { useAnnouncements, useCreateAnnouncement, useDeleteAnnouncement } from '../../hooks/useInchargeDashboard';

const PRIORITY_COLORS = {
    LOW:    { bg:'#1e293b', text:'#64748b' },
    NORMAL: { bg:'#6366f120', text:'#6366f1' },
    HIGH:   { bg:'#f59e0b20', text:'#f59e0b' },
    URGENT: { bg:'#f43f5e20', text:'#f43f5e' }
};

const TARGET_LABELS = { ALL:'Everyone', STUDENT:'Students', STAFF:'Staff', WARDEN:'Wardens', HEADWARDEN:'Head Wardens' };

export default function AnnouncementBoard() {
    const { data: announcements = [], isLoading } = useAnnouncements();
    const { mutate: create, isPending: creating } = useCreateAnnouncement();
    const { mutate: remove } = useDeleteAnnouncement();

    const [form, setForm]   = useState({ title:'', body:'', targetRole:'ALL', priority:'NORMAL', pinned:false });
    const [open, setOpen]   = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.body.trim()) { setError('Title and message are required.'); return; }
        setError('');
        create(form, {
            onSuccess: () => { setForm({ title:'', body:'', targetRole:'ALL', priority:'NORMAL', pinned:false }); setOpen(false); }
        });
    };

    const formatDate = (iso) => new Date(iso).toLocaleDateString('en-IN', {
        day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'
    });

    return (
        <div>
            {/* Header row */}
            <div className="inc-announce-header">
                <div>
                    <div className="inc-section-title" style={{ margin:0 }}>📢 Announcement Board</div>
                    <p style={{ color:'#64748b', fontSize:12, margin:'4px 0 0' }}>Post notices to students, staff, or wardens</p>
                </div>
                <button className="inc-announce-new-btn" onClick={() => setOpen(o => !o)}>
                    {open ? '✕ Cancel' : '+ New Announcement'}
                </button>
            </div>

            {/* Compose Form */}
            {open && (
                <div className="inc-announce-form-wrap">
                    <form onSubmit={handleSubmit} className="inc-announce-form">
                        <div className="inc-announce-form-row">
                            <input
                                className="inc-announce-input"
                                placeholder="Announcement title…"
                                value={form.title}
                                onChange={e => setForm(f => ({...f, title: e.target.value}))}
                                maxLength={100}
                            />
                        </div>
                        <textarea
                            className="inc-announce-textarea"
                            placeholder="Write your announcement here…"
                            rows={4}
                            value={form.body}
                            onChange={e => setForm(f => ({...f, body: e.target.value}))}
                            maxLength={500}
                        />
                        <div className="inc-announce-form-row">
                            <div className="inc-announce-select-wrap">
                                <label>Audience</label>
                                <select className="inc-announce-select" value={form.targetRole} onChange={e => setForm(f => ({...f, targetRole: e.target.value}))}>
                                    {Object.entries(TARGET_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                                </select>
                            </div>
                            <div className="inc-announce-select-wrap">
                                <label>Priority</label>
                                <select className="inc-announce-select" value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))}>
                                    <option value="LOW">Low</option>
                                    <option value="NORMAL">Normal</option>
                                    <option value="HIGH">High</option>
                                    <option value="URGENT">Urgent</option>
                                </select>
                            </div>
                            <label className="inc-announce-pin-label">
                                <input type="checkbox" checked={form.pinned} onChange={e => setForm(f => ({...f, pinned: e.target.checked}))}/>
                                📌 Pin
                            </label>
                        </div>
                        {error && <div className="inc-err" style={{ marginBottom:8 }}>⚠ {error}</div>}
                        <div className="inc-announce-form-row" style={{ justifyContent:'flex-end' }}>
                            <button type="submit" className="inc-announce-submit" disabled={creating}>
                                {creating ? 'Posting…' : '📢 Post Announcement'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List */}
            {isLoading ? (
                <div className="inc-loader"><div className="inc-spinner"/></div>
            ) : announcements.length === 0 ? (
                <div className="inc-empty-state">
                    <div className="inc-empty-icon">📭</div>
                    <div className="inc-empty-title">No announcements yet</div>
                    <div className="inc-empty-sub">Post your first announcement above to notify hostel members.</div>
                </div>
            ) : (
                <div className="inc-announce-list">
                    {announcements.map(a => {
                        const pc = PRIORITY_COLORS[a.priority] || PRIORITY_COLORS.NORMAL;
                        return (
                            <div key={a._id} className={`inc-announce-card${a.pinned ? ' pinned' : ''}`}>
                                <div className="inc-announce-card-header">
                                    <div className="inc-announce-card-left">
                                        {a.pinned && <span className="inc-announce-pin">📌</span>}
                                        <span className="inc-announce-card-title">{a.title}</span>
                                        <span className="inc-announce-priority" style={{ background:pc.bg, color:pc.text }}>{a.priority}</span>
                                        <span className="inc-announce-audience">{TARGET_LABELS[a.targetRole]}</span>
                                    </div>
                                    <button className="inc-announce-delete" onClick={() => remove(a._id)} title="Delete">✕</button>
                                </div>
                                <p className="inc-announce-body">{a.body}</p>
                                <div className="inc-announce-meta">
                                    <span>Posted by {a.createdBy?.name || 'Incharge'}</span>
                                    <span>{formatDate(a.createdAt)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
