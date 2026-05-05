import React, { useContext, useState, useEffect, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import {
    LogOut, User, PlusCircle, CheckCircle, Clock, AlertCircle,
    DoorOpen, Hash, BookOpen, Calendar, X, ImagePlus, Video
} from 'lucide-react';

const CATEGORIES = ['Electrical', 'Plumbing', 'Furniture', 'Cleanliness', 'Internet', 'Other'];

// ─── Media Gallery ────────────────────────────────────────────────────────────
const MediaGallery = ({ media, image }) => {
    const items = media?.length > 0 ? media : (image ? [{ url: image, type: 'image' }] : []);
    if (!items.length) return null;
    return (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {items.map((m, i) =>
                m.type === 'video' ? (
                    <video key={i} src={`http://localhost:5000${m.url}`} controls
                        style={{ width: 160, height: 100, objectFit: 'cover', borderRadius: 8 }} />
                ) : (
                    <img key={i} src={`http://localhost:5000${m.url}`} alt={`attachment-${i}`}
                        style={{ width: 100, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                )
            )}
        </div>
    );
};

// ─── File Preview strip (before submission) ───────────────────────────────────
const FilePreview = ({ files, onRemove }) => {
    if (!files.length) return null;
    return (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {files.map((f, i) => {
                const url = URL.createObjectURL(f);
                const isVideo = f.type.startsWith('video/');
                return (
                    <div key={i} style={{ position: 'relative' }}>
                        {isVideo ? (
                            <video src={url} style={{ width: 100, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                        ) : (
                            <img src={url} alt={f.name} style={{ width: 100, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                        )}
                        <button type="button" onClick={() => onRemove(i)} style={{
                            position: 'absolute', top: -6, right: -6, background: '#ef4444',
                            border: 'none', borderRadius: '50%', width: 20, height: 20,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: 0
                        }}>
                            <X size={12} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

// ─── Status helpers ───────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    if (status === 'Pending')     return <span className="badge badge-pending">Pending</span>;
    if (status === 'In Progress') return <span className="badge badge-progress">In Progress</span>;
    if (status === 'Resolved')    return <span className="badge badge-resolved">Resolved</span>;
    return <span className="badge">{status}</span>;
};
const StatusIcon = ({ status }) => {
    if (status === 'Pending')     return <Clock className="text-warning" size={18} />;
    if (status === 'In Progress') return <AlertCircle className="text-primary" size={18} />;
    if (status === 'Resolved')    return <CheckCircle className="text-success" size={18} />;
    return null;
};

// =============================================================================
const StudentDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const [complaints,   setComplaints]   = useState([]);
    const [loading,      setLoading]      = useState(true);

    // Form state
    const [title,       setTitle]       = useState('');
    const [description, setDescription] = useState('');
    const [category,    setCategory]    = useState('Other');
    const [imageFiles,  setImageFiles]  = useState([]); // File[]
    const [videoFile,   setVideoFile]   = useState(null); // File | null
    const [submitStatus, setSubmitStatus] = useState({ error: '', success: '', loading: false });

    const imageInputRef = useRef(null);
    const videoInputRef = useRef(null);

    useEffect(() => { fetchComplaints(); }, []);

    const fetchComplaints = async () => {
        try {
            const res = await api.get('/complaints/my-complaints');
            setComplaints(res.data);
        } catch (err) {
            console.error('Failed to fetch complaints', err);
        } finally {
            setLoading(false);
        }
    };

    // ── Image selection ────────────────────────────────────────────────────────
    const handleImageChange = (e) => {
        const selected = Array.from(e.target.files);
        setSubmitStatus(s => ({ ...s, error: '' }));

        // Validate count
        if (imageFiles.length + selected.length > 5) {
            setSubmitStatus(s => ({ ...s, error: 'You can attach at most 5 images.' }));
            return;
        }
        // Validate type & size per file
        for (const f of selected) {
            if (!f.type.startsWith('image/')) {
                setSubmitStatus(s => ({ ...s, error: `"${f.name}" is not an image.` }));
                return;
            }
            if (f.size > 20 * 1024 * 1024) {
                setSubmitStatus(s => ({ ...s, error: `"${f.name}" exceeds the 20 MB limit.` }));
                return;
            }
        }
        setImageFiles(prev => [...prev, ...selected]);
        e.target.value = '';
    };

    // ── Video selection ────────────────────────────────────────────────────────
    const handleVideoChange = (e) => {
        const f = e.target.files[0];
        if (!f) return;
        setSubmitStatus(s => ({ ...s, error: '' }));
        if (!f.type.startsWith('video/')) {
            setSubmitStatus(s => ({ ...s, error: `"${f.name}" is not a video.` }));
            return;
        }
        if (f.size > 20 * 1024 * 1024) {
            setSubmitStatus(s => ({ ...s, error: `"${f.name}" exceeds the 20 MB limit.` }));
            return;
        }
        setVideoFile(f);
        e.target.value = '';
    };

    const removeImage = (idx) => setImageFiles(prev => prev.filter((_, i) => i !== idx));
    const removeVideo = ()    => setVideoFile(null);

    // ── Submit ─────────────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitStatus({ error: '', success: '', loading: true });
        try {
            const formData = new FormData();
            formData.append('title',       title);
            formData.append('description', description);
            formData.append('category',    category);
            imageFiles.forEach(f  => formData.append('images', f));
            if (videoFile)         formData.append('video',  videoFile);

            await api.post('/complaints', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

            setSubmitStatus({ error: '', success: 'Complaint submitted successfully!', loading: false });
            setTitle(''); setDescription(''); setCategory('Other');
            setImageFiles([]); setVideoFile(null);
            fetchComplaints();
        } catch (err) {
            setSubmitStatus({ error: err.response?.data?.message || 'Submission failed', success: '', loading: false });
        }
    };

    const allPreviewFiles = [...imageFiles, ...(videoFile ? [videoFile] : [])];

    return (
        <div className="dashboard">
            <aside className="sidebar">
                <div className="sidebar-header"><h2>Student Portal</h2></div>
                <div className="sidebar-nav">
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div className="stat-icon" style={{ margin: '0 auto 1rem', width: '5rem', height: '5rem' }}>
                            <User size={32} />
                        </div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{user?.fullName || user?.name}</h3>
                        <p className="text-muted" style={{ fontSize: '0.875rem' }}>{user?.email}</p>
                    </div>
                    <div className="student-info-list">
                        {user?.doorNumber  && <div className="student-info-item"><DoorOpen size={15}/><span>Door: <strong>{user.doorNumber}</strong></span></div>}
                        {user?.rollNumber  && <div className="student-info-item"><Hash size={15}/><span>Roll No: <strong>{user.rollNumber}</strong></span></div>}
                        {user?.classDiv    && <div className="student-info-item"><BookOpen size={15}/><span>Class: <strong>{user.classDiv}</strong></span></div>}
                        {user?.year        && <div className="student-info-item"><Calendar size={15}/><span>Year: <strong>{user.year}</strong></span></div>}
                    </div>
                </div>
                <div className="sidebar-footer">
                    <button className="btn btn-outline" onClick={logout}>
                        <LogOut size={18} style={{ marginRight: '0.5rem' }} />Logout
                    </button>
                </div>
            </aside>

            <main className="dashboard-content">
                {/* ── Complaint Form ──────────────────────────────────────── */}
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
                    {submitStatus.error   && <div className="error-msg mb-4">{submitStatus.error}</div>}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Title</label>
                            <input type="text" className="form-control" value={title}
                                onChange={(e) => setTitle(e.target.value)} required
                                placeholder="e.g. Broken Fan in Room 204" />
                        </div>
                        <div className="form-group">
                            <label>Description</label>
                            <textarea className="form-control" value={description}
                                onChange={(e) => setDescription(e.target.value)} required rows="3"
                                placeholder="Describe the issue in detail..." />
                        </div>
                        <div className="form-group">
                            <label>Category</label>
                            <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        {/* ── Image upload ─────────────────────────────────── */}
                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ImagePlus size={15} /> Images <span className="text-muted" style={{ fontSize: '0.75rem' }}>(up to 5 · jpg/png/gif/webp · 20 MB each)</span>
                            </label>
                            <button type="button" className="btn btn-outline" style={{ maxWidth: 180, fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                                onClick={() => imageInputRef.current?.click()} disabled={imageFiles.length >= 5}>
                                Add Images
                            </button>
                            <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp"
                                multiple style={{ display: 'none' }} onChange={handleImageChange} />
                            <FilePreview files={imageFiles} onRemove={removeImage} />
                        </div>

                        {/* ── Video upload ─────────────────────────────────── */}
                        <div className="form-group">
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Video size={15} /> Video <span className="text-muted" style={{ fontSize: '0.75rem' }}>(optional · mp4/webm · 20 MB)</span>
                            </label>
                            {!videoFile ? (
                                <>
                                    <button type="button" className="btn btn-outline" style={{ maxWidth: 180, fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                                        onClick={() => videoInputRef.current?.click()}>
                                        Add Video
                                    </button>
                                    <input ref={videoInputRef} type="file" accept="video/mp4,video/webm"
                                        style={{ display: 'none' }} onChange={handleVideoChange} />
                                </>
                            ) : (
                                <div style={{ position: 'relative', display: 'inline-block' }}>
                                    <video src={URL.createObjectURL(videoFile)} controls
                                        style={{ width: 200, height: 120, objectFit: 'cover', borderRadius: 8 }} />
                                    <button type="button" onClick={removeVideo} style={{
                                        position: 'absolute', top: -6, right: -6, background: '#ef4444',
                                        border: 'none', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: 0
                                    }}>
                                        <X size={13} />
                                    </button>
                                </div>
                            )}
                        </div>

                        <button type="submit" className="btn" disabled={submitStatus.loading} style={{ maxWidth: 200 }}>
                            {submitStatus.loading ? 'Submitting...' : 'Submit Complaint'}
                        </button>
                    </form>
                </div>

                {/* ── My Complaints ───────────────────────────────────────── */}
                <div className="card-panel">
                    <h3 style={{ marginBottom: '1.5rem' }}>My Complaints</h3>
                    {loading ? (
                        <p className="text-muted">Loading your complaints...</p>
                    ) : complaints.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem 0', color: '#9ca3af' }}>
                            <PlusCircle size={40} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                            <p>No complaints yet. File one above.</p>
                        </div>
                    ) : (
                        <div className="complaint-list">
                            {complaints.map(complaint => (
                                <div key={complaint._id} className="complaint-item" style={{ flexDirection: 'column' }}>
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

                                    {/* Category chip */}
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                                        <span style={{ fontSize:'0.72rem', background:'#e0e7ff', color:'#4f46e5', borderRadius:20, padding:'2px 10px', fontWeight:600 }}>
                                            {complaint.category || 'Other'}
                                        </span>
                                        {complaint.doorNumber && (
                                            <span className="door-chip"><DoorOpen size={12} /> {complaint.doorNumber}</span>
                                        )}
                                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                                            {new Date(complaint.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>

                                    {/* Staff assignment visibility */}
                                    {complaint.assignedTo && (
                                        <p style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                                            🔧 <strong>Handled by:</strong> {complaint.assignedTo.name}
                                        </p>
                                    )}

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

export default StudentDashboard;
