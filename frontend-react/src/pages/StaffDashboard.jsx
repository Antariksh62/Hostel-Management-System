import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from '../context/AuthContext';
import api from "../services/api";
import { LogOut, User, CheckCircle, Clock, AlertCircle, DoorOpen } from 'lucide-react';

// ─── Status helpers ────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    switch (status) {
        case 'Pending':     return <span className="badge badge-pending">Pending</span>;
        case 'In Progress': return <span className="badge badge-progress">In Progress</span>;
        case 'Resolved':    return <span className="badge badge-resolved">Resolved</span>;
        default:            return <span className="badge">{status}</span>;
    }
};
const StatusIcon = ({ status }) => {
    switch (status) {
        case 'Pending':     return <Clock className="text-warning" size={20} />;
        case 'In Progress': return <AlertCircle className="text-primary" size={20} />;
        case 'Resolved':    return <CheckCircle className="text-success" size={20} />;
        default:            return null;
    }
};

// ─── Media gallery ─────────────────────────────────────────────────────────────
const MediaGallery = ({ media, image }) => {
    const items = media?.length > 0 ? media : (image ? [{ url: image, type: 'image' }] : []);
    if (!items.length) return null;
    return (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
            {items.map((m, i) =>
                m.type === 'video' ? (
                    <video key={i} src={`http://localhost:5000${m.url}`} controls
                        style={{ width: 180, height: 110, objectFit: 'cover', borderRadius: 8 }} />
                ) : (
                    <img key={i} src={`http://localhost:5000${m.url}`} alt={`img-${i}`}
                        style={{ width: 110, height: 90, objectFit: 'cover', borderRadius: 8 }} />
                )
            )}
        </div>
    );
};

// =============================================================================
export default function StaffDashboard() {
    const { user, logout } = useContext(AuthContext);
    const [complaints, setComplaints] = useState([]);
    const [loading,    setLoading]    = useState(true);

    useEffect(() => {
        fetchComplaints();
        const id = setInterval(fetchComplaints, 30000); // refresh every 30s
        return () => clearInterval(id);
    }, [user]);

    const fetchComplaints = async () => {
        try {
            const res  = await api.get("/complaints/all");
            const myId = user?.id || user?._id;
            const assigned = res.data.filter(c => {
                if (!c.assignedTo) return false;
                const assignedId = c.assignedTo._id || c.assignedTo;
                return String(assignedId) === String(myId);
            });
            setComplaints(assigned);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id, status) => {
        try {
            await api.put(`/complaints/${id}/status`, { status });
            fetchComplaints();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="dashboard">
            <aside className="sidebar">
                <div className="sidebar-header"><h2>Staff Portal</h2></div>
                <div className="sidebar-nav">
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div className="stat-icon" style={{ margin: '0 auto 1rem', width: '5rem', height: '5rem' }}>
                            <User size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{user?.name}</h3>
                        <p className="text-muted" style={{ fontSize: '0.875rem' }}>{user?.email}</p>
                        <span style={{ fontSize: '0.75rem', background: '#d1fae5', color: '#059669', padding: '2px 10px', borderRadius: 20, fontWeight: 600 }}>
                            Staff
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
                <div className="card-panel">
                    <h3 style={{ marginBottom: '1.5rem' }}>
                        My Assigned Tasks
                        {complaints.length > 0 && (
                            <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 400, marginLeft: 8 }}>
                                ({complaints.length})
                            </span>
                        )}
                    </h3>

                    {loading ? (
                        <p className="text-muted">Loading assigned tasks...</p>
                    ) : complaints.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2.5rem', color: '#9ca3af' }}>
                            <CheckCircle size={40} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                            <p>No tasks assigned to you at the moment.</p>
                            <p style={{ fontSize: '0.8rem' }}>The warden will assign complaints to you when they come in.</p>
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
                                                    <StatusIcon  status={complaint.status} />
                                                </div>
                                            </div>
                                            <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                                                {complaint.description}
                                            </p>

                                            {/* Category + door + student meta */}
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                                                <span style={{ fontSize:'0.72rem', background:'#e0e7ff', color:'#4f46e5', borderRadius:20, padding:'2px 10px', fontWeight:600 }}>
                                                    {complaint.category || 'Other'}
                                                </span>
                                                {complaint.doorNumber && (
                                                    <span className="door-chip door-chip--admin">
                                                        <DoorOpen size={13} /> {complaint.doorNumber}
                                                    </span>
                                                )}
                                                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                                    {complaint.studentId?.fullName || complaint.studentId?.name || 'Unknown'}
                                                    {complaint.studentId?.rollNumber && ` · Roll ${complaint.studentId.rollNumber}`}
                                                    {complaint.studentId?.classDiv   && ` · ${complaint.studentId.classDiv}`}
                                                </span>
                                            </div>

                                            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
                                                📅 {new Date(complaint.createdAt).toLocaleDateString()}
                                            </p>

                                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                                {complaint.status !== 'In Progress' && complaint.status !== 'Resolved' && (
                                                    <button onClick={() => updateStatus(complaint._id, 'In Progress')}
                                                        className="btn" style={{ maxWidth: 140, padding: '0.45rem 1rem' }}>
                                                        Start Work
                                                    </button>
                                                )}
                                                {complaint.status !== 'Resolved' && (
                                                    <button onClick={() => updateStatus(complaint._id, 'Resolved')}
                                                        className="btn" style={{ maxWidth: 150, background: '#10b981', padding: '0.45rem 1rem' }}>
                                                        Mark Resolved
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Media gallery */}
                                    <MediaGallery media={complaint.media} image={complaint.image} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}