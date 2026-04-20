import React, { useContext, useState, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { LogOut, User, PlusCircle, CheckCircle, Clock, AlertCircle, DoorOpen, Hash, BookOpen, Calendar } from 'lucide-react';

const StudentDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [image, setImage] = useState(null);
    const [submitStatus, setSubmitStatus] = useState({ error: '', success: '', loading: false });
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchComplaints();
    }, []);

    const fetchComplaints = async () => {
        try {
            const res = await api.get('/complaints/my-complaints');
            setComplaints(res.data);
            setLoading(false);
        } catch (error) {
            console.error('Failed to fetch complaints', error);
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        setImage(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitStatus({ error: '', success: '', loading: true });
        
        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            if (image) {
                formData.append('image', image);
            }
            
            await api.post('/complaints', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            setSubmitStatus({ error: '', success: 'Complaint submitted successfully!', loading: false });
            setTitle('');
            setDescription('');
            setImage(null);
            if(fileInputRef.current) fileInputRef.current.value = '';
            fetchComplaints();
        } catch (error) {
            setSubmitStatus({ error: error.response?.data?.message || 'Submission failed', success: '', loading: false });
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
                    <h2>Student Portal</h2>
                </div>
                <div className="sidebar-nav">
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div className="stat-icon" style={{ margin: '0 auto 1rem', width: '5rem', height: '5rem' }}>
                            <User size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{user?.fullName || user?.name}</h3>
                        <p className="text-muted" style={{ fontSize: '0.875rem' }}>{user?.email}</p>
                    </div>

                    {/* Student profile info chips */}
                    <div className="student-info-list">
                        {user?.doorNumber && (
                            <div className="student-info-item">
                                <DoorOpen size={15} />
                                <span>Door: <strong>{user.doorNumber}</strong></span>
                            </div>
                        )}
                        {user?.rollNumber && (
                            <div className="student-info-item">
                                <Hash size={15} />
                                <span>Roll No: <strong>{user.rollNumber}</strong></span>
                            </div>
                        )}
                        {user?.classDiv && (
                            <div className="student-info-item">
                                <BookOpen size={15} />
                                <span>Class: <strong>{user.classDiv}</strong></span>
                            </div>
                        )}
                        {user?.year && (
                            <div className="student-info-item">
                                <Calendar size={15} />
                                <span>Year: <strong>{user.year}</strong></span>
                            </div>
                        )}
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
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <PlusCircle /> File a New Complaint
                    </h3>

                    {user?.doorNumber && (
                        <div className="door-notice">
                            <DoorOpen size={16} />
                            <span>Your door number <strong>{user.doorNumber}</strong> will be auto-attached to this complaint.</span>
                        </div>
                    )}
                    
                    {submitStatus.success && <div className="success-msg mb-4">{submitStatus.success}</div>}
                    {submitStatus.error && <div className="error-msg mb-4">{submitStatus.error}</div>}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Title</label>
                            <input type="text" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Broken Fan in Room 204" />
                        </div>
                        <div className="form-group">
                            <label>Description</label>
                            <textarea className="form-control" value={description} onChange={(e) => setDescription(e.target.value)} required rows="3" placeholder="Provide details..."></textarea>
                        </div>
                        <div className="form-group">
                            <label>Attach Image (Optional)</label>
                            <input type="file" className="form-control" accept="image/*" onChange={handleFileChange} ref={fileInputRef} />
                        </div>
                        <button type="submit" className="btn" disabled={submitStatus.loading} style={{ maxWidth: '200px' }}>
                            {submitStatus.loading ? 'Submitting...' : 'Submit Complaint'}
                        </button>
                    </form>
                </div>

                <div className="card-panel">
                    <h3 style={{ marginBottom: '1.5rem' }}>My Complaints</h3>
                    {loading ? (
                        <p>Loading...</p>
                    ) : complaints.length === 0 ? (
                        <p className="text-muted">You have no active complaints.</p>
                    ) : (
                        <div className="complaint-list">
                            {complaints.map(complaint => (
                                <div key={complaint._id} className="complaint-item" style={{ display: 'flex', gap: '1rem' }}>
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
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                                Submitted on {new Date(complaint.createdAt).toLocaleDateString()}
                                            </p>
                                            {complaint.doorNumber && (
                                                <span className="door-chip">
                                                    <DoorOpen size={12} /> {complaint.doorNumber}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {complaint.image && (
                                        <div style={{ width: '120px' }}>
                                            <img 
                                                src={`http://localhost:5000${complaint.image}`} 
                                                alt="Complaint attachment" 
                                                className="img-preview"
                                                style={{ width: '100%', height: '100px' }}
                                            />
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

export default StudentDashboard;
