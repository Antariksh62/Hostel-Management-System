import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { LogOut, User, CheckCircle, Clock, AlertCircle, Trash2 } from 'lucide-react';

const AdminDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const [complaints, setComplaints] = useState([]);
    const [students, setStudents] = useState([]);
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
        
        // Auto-refresh the dashboard every 5 seconds to get new complaints automatically
        const intervalId = setInterval(() => {
            fetchData();
        }, 5000);

        return () => clearInterval(intervalId);
    }, []);

    // ✅ SINGLE CLEAN fetchData
    const fetchData = async () => {
        try {
            const [complaintsRes, studentsRes, usersRes] = await Promise.all([
                api.get('/complaints/all'),
                api.get('/users/students'),
                api.get('/users')
            ]);

            setComplaints(complaintsRes.data);
            setStudents(studentsRes.data);

            const staffOnly = usersRes.data.filter(u => u.role === "STAFF");
            setStaff(staffOnly);

            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch admin data', error);
            setLoading(false);
        }
    };

    // ✅ STATUS UPDATE
    const handleStatusUpdate = async (id, newStatus) => {
        try {
            await api.put(`/complaints/${id}/status`, { status: newStatus });
            fetchData();
        } catch (error) {
            alert('Failed to update status');
        }
    };

    // ✅ DELETE
    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this complaint?')) return;
        try {
            await api.delete(`/complaints/${id}`);
            fetchData();
        } catch (error) {
            alert('Failed to delete');
        }
    };

    // ✅ ASSIGN (NEW)
    const handleAssign = async (id, staffId) => {
        try {
            await api.put(`/complaints/assign/${id}`, { staffId });
            fetchData();
        } catch (error) {
            alert("Failed to assign complaint");
        }
    };

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

    return (
        <div className="dashboard">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <h2>Admin Portal</h2>
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
                    <h3 style={{ marginBottom: '1.5rem' }}>All Complaints Management</h3>
                    {loading ? (
                        <p>Loading...</p>
                    ) : complaints.length === 0 ? (
                        <p className="text-muted">No complaints found in the system at the moment.</p>
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
                                            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '1rem' }}>
                                                Submitted by: {complaint.studentId?.name || 'Unknown User'} | Date: {new Date(complaint.createdAt).toLocaleDateString()}
                                            </p>

                                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                                                
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.2rem' }}>Update Status:</label>
                                                    <select
                                                        value={complaint.status}
                                                        onChange={(e) => handleStatusUpdate(complaint._id, e.target.value)}
                                                        className="form-control"
                                                        style={{ width: '150px', padding: '0.5rem' }}
                                                    >
                                                        <option value="Pending">Pending</option>
                                                        <option value="In Progress">In Progress</option>
                                                        <option value="Resolved">Resolved</option>
                                                    </select>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <label style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.2rem' }}>Assign Staff:</label>
                                                    <select
                                                        value={complaint.assignedTo?._id || ""}
                                                        onChange={(e) => handleAssign(complaint._id, e.target.value)}
                                                        className="form-control"
                                                        style={{ width: '180px', padding: '0.5rem' }}
                                                    >
                                                        <option value="">Unassigned</option>
                                                        {staff.map(s => (
                                                            <option key={s._id} value={s._id}>
                                                                {s.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <button onClick={() => handleDelete(complaint._id)} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', borderColor: '#ef4444', height: 'fit-content', marginTop: 'auto' }}>
                                                    <Trash2 size={16} /> Delete
                                                </button>
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