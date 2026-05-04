import React, { useContext, useState, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { LogOut, User, PlusCircle, CheckCircle, Clock, AlertCircle, DoorOpen, Hash, BookOpen, Calendar, Star, MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react';

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

    // Feedback state
    const [activeFeedbackId, setActiveFeedbackId] = useState(null);
    const [feedbackData, setFeedbackData] = useState({ isResolved: true, comment: '' });
    const [feedbackImage, setFeedbackImage] = useState(null);
    const feedbackImageRef = useRef(null);

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

    const handleFeedbackSubmit = async (complaintId) => {
        try {
            if (!feedbackData.isResolved && !feedbackData.comment.trim()) {
                alert("Please provide a reason why it is not resolved.");
                return;
            }

            let dataToSubmit;
            let headers = {};

            if (!feedbackData.isResolved && feedbackImage) {
                dataToSubmit = new FormData();
                dataToSubmit.append('isResolved', feedbackData.isResolved);
                dataToSubmit.append('comment', feedbackData.comment);
                dataToSubmit.append('image', feedbackImage);
                headers = { 'Content-Type': 'multipart/form-data' };
            } else {
                dataToSubmit = feedbackData;
            }

            await api.put(`/complaints/${complaintId}/feedback`, dataToSubmit, { headers });
            setActiveFeedbackId(null);
            setFeedbackData({ isResolved: true, comment: '' });
            setFeedbackImage(null);
            if (feedbackImageRef.current) feedbackImageRef.current.value = '';
            fetchComplaints();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to submit feedback');
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

                                        {/* FEEDBACK SECTION */}
                                        <div style={{ marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                                            {complaint.status === 'Resolved' && (!complaint.feedback || complaint.feedback.isResolved == null || complaint.feedback.isResolved === false) && activeFeedbackId !== complaint._id && (
                                                <button className="btn btn-outline provide-feedback-btn" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }} onClick={() => setActiveFeedbackId(complaint._id)}>
                                                    <MessageSquare size={16} style={{ marginRight: '0.5rem' }} /> Provide Feedback
                                                </button>
                                            )}

                                            {activeFeedbackId === complaint._id && (
                                                <div className="feedback-form" style={{ background: '#f9fafb', padding: '1rem', borderRadius: '0.5rem' }}>
                                                    <h5 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: '500' }}>Was this issue resolved satisfactorily?</h5>
                                                    
                                                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                                                        <button 
                                                            className={`btn ${feedbackData.isResolved ? 'btn-primary' : 'btn-outline'}`}
                                                            onClick={() => setFeedbackData({ ...feedbackData, isResolved: true })}
                                                            style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                                                            <ThumbsUp size={16} style={{ marginRight: '0.5rem' }} /> Yes, it's fixed
                                                        </button>
                                                        <button 
                                                            className={`btn ${!feedbackData.isResolved ? 'btn-danger' : 'btn-outline'}`}
                                                            onClick={() => setFeedbackData({ ...feedbackData, isResolved: false })}
                                                            style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                                                            <ThumbsDown size={16} style={{ marginRight: '0.5rem' }} /> No, still needs work
                                                        </button>
                                                    </div>

                                                    {!feedbackData.isResolved && (
                                                        <>
                                                            <div className="form-group">
                                                                <label>Reason / Comments (Required)</label>
                                                                <textarea className="form-control" rows="2" required value={feedbackData.comment} onChange={(e) => setFeedbackData({ ...feedbackData, comment: e.target.value })} placeholder="Why is the work still incomplete?"></textarea>
                                                            </div>
                                                            
                                                            <div className="form-group">
                                                                <label>Attach Image of Undone Work (Optional)</label>
                                                                <input type="file" className="form-control" accept="image/*" onChange={(e) => setFeedbackImage(e.target.files[0])} ref={feedbackImageRef} />
                                                            </div>
                                                        </>
                                                    )}

                                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                                        <button className="btn btn-outline" onClick={() => setActiveFeedbackId(null)}>Cancel</button>
                                                        <button className="btn btn-primary" onClick={() => handleFeedbackSubmit(complaint._id)}>Submit Feedback</button>
                                                    </div>
                                                </div>
                                            )}

                                            {complaint.feedback && (
                                                <div className="feedback-summary" style={{ background: '#f3f4f6', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                                        <strong style={{ color: '#374151' }}>Your Feedback:</strong>
                                                        {complaint.feedback.isResolved ? (
                                                            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: '500' }}><ThumbsUp size={14} /> Resolved</span>
                                                        ) : (
                                                            <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: '500' }}><ThumbsDown size={14} /> Not Resolved</span>
                                                        )}
                                                    </div>
                                                    {complaint.feedback.comment && (
                                                        <p style={{ color: '#4b5563', margin: 0, fontStyle: 'italic', borderLeft: '3px solid #cbd5e1', paddingLeft: '0.5rem', marginTop: '0.25rem' }}>{complaint.feedback.comment}</p>
                                                    )}
                                                    {complaint.feedback.image && (
                                                        <div style={{ marginTop: '0.5rem' }}>
                                                            <strong style={{ color: '#374151', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>Attached Evidence:</strong>
                                                            <img 
                                                                src={`http://localhost:5000${complaint.feedback.image}`} 
                                                                alt="Feedback attachment" 
                                                                style={{ width: '100px', height: 'auto', borderRadius: '4px', border: '1px solid #d1d5db' }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
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
