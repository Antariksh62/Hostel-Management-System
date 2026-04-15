import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { LogOut, Users, AlertCircle, FileText, CheckCircle, Trash2 } from 'lucide-react';

const AdminDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const [complaints, setComplaints] = useState([]);
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [complaintsRes, studentsRes] = await Promise.all([
                api.get('/complaints/all'),
                api.get('/users/students')
            ]);
            setComplaints(complaintsRes.data);
            setStudents(studentsRes.data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch admin data', error);
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (id, newStatus) => {
        try {
            await api.put(`/complaints/${id}/status`, { status: newStatus });
            fetchData(); // Refresh list
        } catch (error) {
            alert('Failed to update status');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this complaint?')) return;
        try {
            await api.delete(`/complaints/${id}`);
            fetchData();
        } catch (error) {
            alert('Failed to delete complaint');
        }
    };

    // Calculate stats
    const totalStudents = students.length;
    const totalComplaints = complaints.length;
    const pendingComplaints = complaints.filter(c => c.status === 'Pending').length;
    const resolvedComplaints = complaints.filter(c => c.status === 'Resolved').length;

    const StatusBadge = ({ status }) => {
        switch (status) {
            case 'Pending': return <span className="badge badge-pending">Pending</span>;
            case 'In Progress': return <span className="badge badge-progress">In Progress</span>;
            case 'Resolved': return <span className="badge badge-resolved">Resolved</span>;
            default: return <span className="badge">{status}</span>;
        }
    };

    return (
        <div className="dashboard">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h2>Admin Portal</h2>
                </div>
                <div className="sidebar-nav">
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div className="stat-icon" style={{ margin: '0 auto 1rem', width: '5rem', height: '5rem' }}>
                            <Users size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{user?.name}</h3>
                        <p className="text-muted" style={{ fontSize: '0.875rem' }}>{user?.role}</p>
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
                <div className="stats-grid">
                    <div className="stat-card">
                        <div>
                            <h3>Total Students</h3>
                            <div className="value">{totalStudents}</div>
                        </div>
                        <div className="stat-icon"><Users size={24} /></div>
                    </div>
                    <div className="stat-card">
                        <div>
                            <h3>Total Complaints</h3>
                            <div className="value">{totalComplaints}</div>
                        </div>
                        <div className="stat-icon"><FileText size={24} /></div>
                    </div>
                    <div className="stat-card">
                        <div>
                            <h3>Pending Issues</h3>
                            <div className="value" style={{ color: 'var(--warning)' }}>{pendingComplaints}</div>
                        </div>
                        <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
                            <AlertCircle size={24} />
                        </div>
                    </div>
                    <div className="stat-card">
                        <div>
                            <h3>Resolved</h3>
                            <div className="value" style={{ color: 'var(--success)' }}>{resolvedComplaints}</div>
                        </div>
                        <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                            <CheckCircle size={24} />
                        </div>
                    </div>
                </div>

                <div className="card-panel">
                    <h3 style={{ marginBottom: '1.5rem' }}>All Complaints Management</h3>
                    {loading ? (
                        <p>Loading...</p>
                    ) : complaints.length === 0 ? (
                        <p className="text-muted">No complaints found.</p>
                    ) : (
                        <div className="complaint-list">
                            {complaints.map(complaint => (
                                <div key={complaint._id} className="complaint-item" style={{ display: 'flex', gap: '1.5rem' }}>
                                    <div style={{ flex: '1' }}>
                                        <div className="complaint-header">
                                            <div>
                                                <h4 className="complaint-title">{complaint.title}</h4>
                                                <div style={{ fontSize: '0.875rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                                                    Reported by: {complaint.studentId?.name} ({complaint.studentId?.email})
                                                </div>
                                            </div>
                                            <StatusBadge status={complaint.status} />
                                        </div>
                                        <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>
                                            {complaint.description}
                                        </p>
                                        
                                        <div className="flex items-center justify-between">
                                            <div className="flex gap-2 items-center">
                                                <select 
                                                    className="form-control" 
                                                    style={{ width: 'auto', padding: '0.4rem', fontSize: '0.875rem' }}
                                                    value={complaint.status}
                                                    onChange={(e) => handleStatusUpdate(complaint._id, e.target.value)}
                                                >
                                                    <option value="Pending">Pending</option>
                                                    <option value="In Progress">In Progress</option>
                                                    <option value="Resolved">Resolved</option>
                                                </select>
                                                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                                    {new Date(complaint.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            
                                            <button 
                                                className="btn btn-danger btn-sm flex items-center gap-2" 
                                                style={{ width: 'auto' }}
                                                onClick={() => handleDelete(complaint._id)}
                                            >
                                                <Trash2 size={14} /> Delete
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {complaint.image && (
                                        <div style={{ width: '150px' }}>
                                            <a href={`http://localhost:5000${complaint.image}`} target="_blank" rel="noreferrer">
                                                <img 
                                                    src={`http://localhost:5000${complaint.image}`} 
                                                    alt="Attached evidence" 
                                                    className="img-preview"
                                                    style={{ width: '100%', height: '120px' }}
                                                />
                                            </a>
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
};

export default AdminDashboard;
