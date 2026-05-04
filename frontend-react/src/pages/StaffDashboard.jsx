import React, { useEffect, useState, useContext } from "react";
import { AuthContext } from '../context/AuthContext';
import api from "../services/api";
import { LogOut, User, CheckCircle, Clock, AlertCircle, DoorOpen, Star, ThumbsUp, ThumbsDown } from 'lucide-react';

export default function StaffDashboard() {
  const { user, logout } = useContext(AuthContext);
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComplaints();

    // Auto-refresh the dashboard every 5 seconds to get new assignments automatically
    const intervalId = setInterval(() => {
        fetchComplaints();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [user]);

  const fetchComplaints = async () => {
    try {
      const res = await api.get("/complaints/all");

      // Staff only sees what they are assigned to
      // user.id comes from the login response (backend sends `id`, not `_id`)
      const myId = user?.id || user?._id;

      const assigned = res.data.filter(c => {
        if (!c.assignedTo) return false;
        // assignedTo can be a populated object { _id, name } or a raw string
        const assignedId = c.assignedTo._id || c.assignedTo;
        return String(assignedId) === String(myId);
      });

      setComplaints(assigned);
      setLoading(false);
    } catch (err) {
      console.error(err);
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

  const StatusBadge = ({ status }) => {
    switch (status) {
        case 'Pending': return <span className="badge badge-pending">Pending</span>;
        case 'In Progress': return <span className="badge badge-progress">In Progress</span>;
        case 'Resolved': return <span className="badge badge-resolved">Resolved</span>;
        default: return <span className="badge">{status}</span>;
    }
  };

  const StatusIcon = ({ status }) => {
      switch (status) {
          case 'Pending': return <Clock className="text-warning" size={20} />;
          case 'In Progress': return <AlertCircle className="text-primary" size={20} />;
          case 'Resolved': return <CheckCircle className="text-success" size={20} />;
          default: return null;
      }
  };

  return (
    <div className="dashboard">
        <aside className="sidebar">
            <div className="sidebar-header">
                <h2>Staff Portal</h2>
            </div>
            <div className="sidebar-nav">
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div className="stat-icon" style={{ margin: '0 auto 1rem', width: '5rem', height: '5rem' }}>
                        <User size={32} />
                    </div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{user?.name}</h3>
                    <p className="text-muted" style={{ fontSize: '0.875rem' }}>{user?.email}</p>
                </div>
            </div>
            <div className="sidebar-footer">
                <button className="btn btn-outline" onClick={logout}>
                    <LogOut size={18} style={{ marginRight: '0.5rem' }} />
                    Logout
                </button>
            </div>
        </aside>

        <main className="dashboard-content">
            <div className="card-panel">
                <h3 style={{ marginBottom: '1.5rem' }}>Assigned Tasks</h3>
                {loading ? (
                    <p>Loading...</p>
                ) : complaints.length === 0 ? (
                    <p className="text-muted">You have no tasks assigned at the moment.</p>
                ) : (
                    <div className="complaint-list">
                        {complaints.map(complaint => (
                            <div key={complaint._id} className="complaint-item" style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    <div style={{ flex: '1' }}>
                                        <div className="complaint-header">
                                            <h4 className="complaint-title">{complaint.title}</h4>
                                            <div className="flex items-center gap-2">
                                                <StatusBadge status={complaint.status} />
                                                <StatusIcon status={complaint.status} />
                                            </div>
                                        </div>
                                        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                                            {complaint.description}
                                        </p>
                                        {/* Door number + student info */}
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                                            {complaint.doorNumber && (
                                                <span className="door-chip door-chip--admin">
                                                    <DoorOpen size={13} /> {complaint.doorNumber}
                                                </span>
                                            )}
                                            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                                {complaint.studentId?.fullName || complaint.studentId?.name || 'Unknown'}
                                                {complaint.studentId?.rollNumber && ` · Roll ${complaint.studentId.rollNumber}`}
                                                {complaint.studentId?.classDiv && ` · ${complaint.studentId.classDiv}`}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '1rem' }}>
                                            Date: {new Date(complaint.createdAt).toLocaleDateString()}
                                        </p>

                                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                            {complaint.status !== 'In Progress' && complaint.status !== 'Resolved' && (
                                                <button onClick={() => updateStatus(complaint._id, 'In Progress')} className="btn" style={{ maxWidth: '150px' }}>
                                                    Start Work
                                                </button>
                                            )}
                                            {complaint.status !== 'Resolved' && (
                                                <button onClick={() => updateStatus(complaint._id, 'Resolved')} className="btn" style={{ maxWidth: '150px', background: '#10b981' }}>
                                                    Mark Resolved
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {complaint.image && (
                                        <div style={{ width: '150px' }}>
                                            <img 
                                                src={`http://localhost:5000${complaint.image}`} 
                                                alt="Complaint attachment" 
                                                className="img-preview"
                                                style={{ width: '100%', height: 'auto', borderRadius: '8px' }}
                                            />
                                        </div>
                                    )}
                                </div>
                                {/* STAFF-SIDE FEEDBACK VIEW */}
                                {complaint.feedback && (
                                    <div className="feedback-summary mt-2" style={{ background: '#fef3c7', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.875rem', marginTop: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <strong style={{ color: '#92400e' }}>Student Feedback:</strong>
                                            {complaint.feedback.isResolved ? (
                                                <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: '500' }}><ThumbsUp size={14} /> Resolved</span>
                                            ) : (
                                                <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: '500' }}><ThumbsDown size={14} /> Not Resolved (Reopened)</span>
                                            )}
                                        </div>
                                        {complaint.feedback.comment && (
                                            <p style={{ color: '#92400e', margin: 0, fontStyle: 'italic', borderLeft: '3px solid #fcd34d', paddingLeft: '0.5rem', marginTop: '0.25rem' }}>{complaint.feedback.comment}</p>
                                        )}
                                        {complaint.feedback.image && (
                                            <div style={{ marginTop: '0.5rem' }}>
                                                <strong style={{ color: '#92400e', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Attached Evidence:</strong>
                                                <img 
                                                    src={`http://localhost:5000${complaint.feedback.image}`} 
                                                    alt="Feedback attachment" 
                                                    style={{ width: '100px', height: 'auto', borderRadius: '4px', border: '1px solid #fcd34d' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    </div>
  );
}