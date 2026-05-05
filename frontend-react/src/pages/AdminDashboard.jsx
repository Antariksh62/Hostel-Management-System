import React, { useContext, useState, useEffect, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import {
    LogOut, User, CheckCircle, Clock, AlertCircle, Trash2,
    DoorOpen, Search, Filter, X, BarChart2, TrendingUp
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    LineChart, Line, CartesianGrid
} from 'recharts';

const CATEGORIES = ['Electrical', 'Plumbing', 'Furniture', 'Cleanliness', 'Internet', 'Other'];
const CATEGORY_COLORS = {
    Electrical: '#4f46e5', Plumbing: '#06b6d4', Furniture: '#f59e0b',
    Cleanliness: '#10b981', Internet: '#8b5cf6', Other: '#6b7280'
};

// ─── Status helpers ────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    if (status === 'Pending') return <span className="badge badge-pending">Pending</span>;
    if (status === 'In Progress') return <span className="badge badge-progress">In Progress</span>;
    if (status === 'Resolved') return <span className="badge badge-resolved">Resolved</span>;
    return <span className="badge">{status}</span>;
};
const StatusIcon = ({ status }) => {
    if (status === 'Pending') return <Clock className="text-warning" size={20} />;
    if (status === 'In Progress') return <AlertCircle className="text-primary" size={20} />;
    if (status === 'Resolved') return <CheckCircle className="text-success" size={20} />;
    return null;
};

// ─── Media gallery (inline on complaint cards) ─────────────────────────────────
const MediaGallery = ({ media, image }) => {
    const items = media?.length > 0 ? media : (image ? [{ url: image, type: 'image' }] : []);
    if (!items.length) return null;
    return (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {items.map((m, i) =>
                m.type === 'video' ? (
                    <video key={i} src={`http://localhost:5000${m.url}`} controls
                        style={{ width: 150, height: 100, objectFit: 'cover', borderRadius: 8 }} />
                ) : (
                    <img key={i} src={`http://localhost:5000${m.url}`} alt={`img-${i}`}
                        style={{ width: 100, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                )
            )}
        </div>
    );
};

// ─── Analytics Panel ──────────────────────────────────────────────────────────
const AnalyticsPanel = ({ analytics, days, onDaysChange, loading }) => {
    if (loading) return (
        <div className="card-panel" style={{ marginBottom: '1.5rem' }}>
            <p className="text-muted">Loading analytics...</p>
        </div>
    );
    if (!analytics) return null;

    const statCards = [
        { label: 'Total', value: analytics.total, color: '#4f46e5', bg: '#e0e7ff' },
        { label: 'Pending', value: analytics.pending, color: '#d97706', bg: '#fef3c7' },
        { label: 'In Progress', value: analytics.inProgress, color: '#7c3aed', bg: '#ede9fe' },
        { label: 'Resolved', value: analytics.resolved, color: '#059669', bg: '#d1fae5' },
    ];

    return (
        <div className="card-panel" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                    <BarChart2 size={20} /> Analytics Overview
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[7, 30].map(d => (
                        <button key={d} onClick={() => onDaysChange(d)}
                            className={`btn ${days === d ? '' : 'btn-outline'}`}
                            style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem' }}>
                            {d}d
                        </button>
                    ))}
                </div>
            </div>

            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {statCards.map(({ label, value, color, bg }) => (
                    <div key={label} style={{ background: bg, borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 800, color }}>{value}</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 600 }}>{label}</div>
                    </div>
                ))}
                {analytics.avgResolutionHours !== null && (
                    <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669' }}>{analytics.avgResolutionHours}h</div>
                        <div style={{ fontSize: '0.73rem', color: '#6b7280', fontWeight: 600 }}>Avg Resolve</div>
                    </div>
                )}
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* Bar chart: by category */}
                <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>By Category</p>
                    {analytics.byCategory?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={analytics.byCategory} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                                <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                <Tooltip />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {analytics.byCategory.map((entry) => (
                                        <Cell key={entry._id} fill={CATEGORY_COLORS[entry._id] || '#4f46e5'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <p className="text-muted" style={{ fontSize: '0.8rem' }}>No data yet.</p>}
                </div>

                {/* Line chart: daily trend */}
                <div>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                        <TrendingUp size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        Complaints per Day (last {days}d)
                    </p>
                    {analytics.trend?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                            <LineChart data={analytics.trend} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }}
                                    tickFormatter={(d) => d.slice(5)} />
                                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                                <Tooltip labelFormatter={(d) => `Date: ${d}`} />
                                <Line type="monotone" dataKey="count" stroke="#4f46e5"
                                    strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : <p className="text-muted" style={{ fontSize: '0.8rem' }}>No data for this period.</p>}
                </div>
            </div>
        </div>
    );
};

// ─── Filter Bar ────────────────────────────────────────────────────────────────
const FilterBar = ({ filters, setFilters, searchInput, setSearchInput }) => {
    const hasActiveFilters = filters.status || filters.category || filters.from || filters.to || searchInput;

    const clearAll = () => {
        setSearchInput('');
        setFilters({ status: '', category: '', from: '', to: '', student: '' });
    };

    return (
        <div className="card-panel" style={{ marginBottom: '1.5rem', padding: '1rem 1.5rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <Filter size={16} style={{ color: '#6b7280', flexShrink: 0 }} />

                {/* Keyword search */}
                <div style={{ position: 'relative', flex: '1', minWidth: 180 }}>
                    <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Search title, description..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        style={{ paddingLeft: '2rem', height: 45, fontSize: '0.875rem' }}
                    />
                </div>

                {/* Student name search */}
                <div style={{ position: 'relative', minWidth: 150 }}>
                    <User size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Student name..."
                        value={filters.student}
                        onChange={(e) => setFilters(f => ({ ...f, student: e.target.value }))}
                        style={{ paddingLeft: '2rem', height: 45, fontSize: '0.875rem' }}
                    />
                </div>

                {/* Status */}
                <select className="form-control" value={filters.status}
                    onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                    style={{ height: 45, fontSize: '0.875rem', width: 140 }}>
                    <option value="">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                </select>

                {/* Category */}
                <select className="form-control" value={filters.category}
                    onChange={(e) => setFilters(f => ({ ...f, category: e.target.value }))}
                    style={{ height: 45, fontSize: '0.875rem', width: 140 }}>
                    <option value="">All Categories</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                {/* Date range */}
                <input type="date" className="form-control" value={filters.from}
                    onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))}
                    style={{ height: 45, fontSize: '0.875rem', width: 140 }} />
                <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>to</span>
                <input type="date" className="form-control" value={filters.to}
                    onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}
                    style={{ height: 45, fontSize: '0.875rem', width: 140 }} />

                {/* Clear */}
                {hasActiveFilters && (
                    <button className="btn btn-outline" onClick={clearAll}
                        style={{ height: 45, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.875rem', color: '#ef4444', borderColor: '#ef4444', whiteSpace: 'nowrap' }}>
                        <X size={14} /> Clear
                    </button>
                )}
            </div>
        </div>
    );
};

// =============================================================================
const AdminDashboard = () => {
    const { user, logout } = useContext(AuthContext);

    const [complaints, setComplaints] = useState([]);
    const [staff, setStaff] = useState([]);
    const [analytics, setAnalytics] = useState(null);
    const [complaintsLoading, setComplaintsLoading] = useState(true);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [analyticsDays, setAnalyticsDays] = useState(7);

    // Filters
    const [filters, setFilters] = useState({ status: '', category: '', from: '', to: '', student: '' });
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce keyword search 300ms
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    // Fetch complaints when filters or search change
    useEffect(() => { fetchComplaints(); }, [filters, debouncedSearch]);

    // Fetch analytics when days toggle changes
    useEffect(() => { fetchAnalytics(); }, [analyticsDays]);

    // Auto-refresh complaints every 30s
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        const id = setInterval(fetchComplaints, 30000);
        return () => clearInterval(id);
    }, []); // mount/unmount only — filter-driven refresh handled above

    const buildQuery = useCallback(() => {
        const params = new URLSearchParams();
        if (filters.status) params.set('status', filters.status);
        if (filters.category) params.set('category', filters.category);
        if (filters.from) params.set('from', filters.from);
        if (filters.to) params.set('to', filters.to);
        if (filters.student) params.set('student', filters.student);
        if (debouncedSearch) params.set('search', debouncedSearch);
        return params.toString();
    }, [filters, debouncedSearch]);

    const fetchComplaints = async () => {
        setComplaintsLoading(true);
        try {
            const qs = buildQuery();
            const res = await api.get(`/complaints/all${qs ? `?${qs}` : ''}`);
            setComplaints(res.data);
        } catch (err) {
            console.error('Failed to fetch complaints', err);
        } finally {
            setComplaintsLoading(false);
        }
    };

    const fetchAnalytics = async () => {
        setAnalyticsLoading(true);
        try {
            const res = await api.get(`/complaints/analytics?days=${analyticsDays}`);
            setAnalytics(res.data);
        } catch (err) {
            console.error('Failed to fetch analytics', err);
        } finally {
            setAnalyticsLoading(false);
        }
    };

    const fetchStaff = async () => {
        try {
            const res = await api.get('/users/');
            setStaff(res.data.filter(u => u.role === 'STAFF'));
        } catch (err) {
            console.error('Failed to fetch staff', err);
        }
    };
    // Fetch staff once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchStaff(); }, []);

    const handleStatusUpdate = async (id, newStatus) => {
        try {
            await api.put(`/complaints/${id}/status`, { status: newStatus });
            fetchComplaints();
            fetchAnalytics();
        } catch { alert('Failed to update status'); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this complaint and all its attachments?')) return;
        try {
            await api.delete(`/complaints/${id}`);
            fetchComplaints();
            fetchAnalytics();
        } catch { alert('Failed to delete'); }
    };

    const handleAssign = async (id, staffId) => {
        if (!staffId) return;
        try {
            await api.put(`/complaints/assign/${id}`, { staffId });
            fetchComplaints();
        } catch { alert('Failed to assign complaint'); }
    };

    return (
        <div className="dashboard">
            <aside className="sidebar">
                <div className="sidebar-header"><h2>Admin Portal</h2></div>
                <div className="sidebar-nav">
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div className="stat-icon" style={{ margin: '0 auto 1rem', width: '5rem', height: '5rem' }}>
                            <User size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{user?.name}</h3>
                        <p className="text-muted" style={{ fontSize: '0.875rem' }}>{user?.email}</p>
                        <span style={{ fontSize: '0.75rem', background: '#e0e7ff', color: '#4f46e5', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>
                            Warden
                        </span>
                    </div>
                </div>
                <div className="sidebar-footer">
                    <button className="btn btn-outline" onClick={logout}>
                        <LogOut size={18} style={{ marginRight: '0.5rem' }} />Logout
                    </button>
                </div>
            </aside>

            <main className="dashboard-content">
                {/* ── Analytics ───────────────────────────────────────────── */}
                <AnalyticsPanel
                    analytics={analytics}
                    days={analyticsDays}
                    onDaysChange={setAnalyticsDays}
                    loading={analyticsLoading}
                />

                {/* ── Filter Bar ───────────────────────────────────────────── */}
                <FilterBar
                    filters={filters}
                    setFilters={setFilters}
                    searchInput={searchInput}
                    setSearchInput={setSearchInput}
                />

                {/* ── Complaints List ──────────────────────────────────────── */}
                <div className="card-panel">
                    <h3 style={{ marginBottom: '1rem' }}>
                        All Complaints
                        {complaints.length > 0 && (
                            <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 400, marginLeft: 8 }}>
                                ({complaints.length} result{complaints.length !== 1 ? 's' : ''})
                            </span>
                        )}
                    </h3>

                    {complaintsLoading ? (
                        <p className="text-muted">Loading complaints...</p>
                    ) : complaints.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2.5rem', color: '#9ca3af' }}>
                            <Search size={40} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                            <p>No complaints match your filters.</p>
                        </div>
                    ) : (
                        <div className="complaint-list">
                            {complaints.map(complaint => (
                                <div key={complaint._id} className="complaint-item" style={{ flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <div className="complaint-header">
                                                <h4 className="complaint-title">{complaint.title}</h4>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <StatusBadge status={complaint.status} />
                                                    <StatusIcon status={complaint.status} />
                                                </div>
                                            </div>
                                            <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                                                {complaint.description}
                                            </p>

                                            {/* Meta row */}
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                                                {/* Category chip */}
                                                <span style={{ fontSize: '0.72rem', background: '#e0e7ff', color: '#4f46e5', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>
                                                    {complaint.category || 'Other'}
                                                </span>
                                                {complaint.doorNumber && (
                                                    <span className="door-chip door-chip--admin">
                                                        <DoorOpen size={13} /> {complaint.doorNumber}
                                                    </span>
                                                )}
                                                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                                    By: <strong>{complaint.studentId?.fullName || complaint.studentId?.name || 'Unknown'}</strong>
                                                    {complaint.studentId?.rollNumber && ` · Roll ${complaint.studentId.rollNumber}`}
                                                    {complaint.studentId?.classDiv && ` · ${complaint.studentId.classDiv}`}
                                                    {complaint.studentId?.year && ` · ${complaint.studentId.year}`}
                                                </span>
                                            </div>

                                            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
                                                📅 {new Date(complaint.createdAt).toLocaleDateString()}
                                                {complaint.assignedTo && (
                                                    <span style={{ marginLeft: 8, color: '#6b7280', fontWeight: 600 }}>
                                                        · 👷 Assigned to: <strong>{complaint.assignedTo.name}</strong>
                                                    </span>
                                                )}
                                            </p>

                                            {/* Action row */}
                                            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                                <div>
                                                    <label style={{ fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: 3 }}>Status</label>
                                                    <select value={complaint.status}
                                                        onChange={(e) => handleStatusUpdate(complaint._id, e.target.value)}
                                                        className="form-control" style={{ width: 150, padding: '0.4rem' }}>
                                                        <option value="Pending">Pending</option>
                                                        <option value="In Progress">In Progress</option>
                                                        <option value="Resolved">Resolved</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.72rem', fontWeight: 700, display: 'block', marginBottom: 3 }}>Assign Staff</label>
                                                    <select value={complaint.assignedTo?._id || ''}
                                                        onChange={(e) => handleAssign(complaint._id, e.target.value)}
                                                        className="form-control" style={{ width: 180, padding: '0.4rem' }}>
                                                        <option value="">Unassigned</option>
                                                        {staff.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                                    </select>
                                                </div>
                                                <button onClick={() => handleDelete(complaint._id)} className="btn btn-outline"
                                                    style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#ef4444', borderColor: '#ef4444', padding: '0.4rem 0.75rem' }}>
                                                    <Trash2 size={15} /> Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Media */}
                                    <MediaGallery media={complaint.media} image={complaint.image} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;