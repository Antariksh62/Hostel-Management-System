import React, { useState, useContext, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { Mail, KeyRound, UserCircle, ArrowRight, RefreshCw, DoorOpen } from 'lucide-react';

// ─── Step Indicator ───────────────────────────────────────────────────────────
const StepIndicator = ({ currentStep }) => (
    <div className="otp-steps">
        {['Email', 'OTP', 'Profile'].map((label, idx) => {
            const step = idx + 1;
            const isActive = step === currentStep;
            const isDone = step < currentStep;
            return (
                <React.Fragment key={step}>
                    <div className={`otp-step ${isActive ? 'otp-step--active' : ''} ${isDone ? 'otp-step--done' : ''}`}>
                        <div className="otp-step-circle">{isDone ? '✓' : step}</div>
                        <span className="otp-step-label">{label}</span>
                    </div>
                    {idx < 2 && <div className={`otp-step-line ${isDone ? 'otp-step-line--done' : ''}`} />}
                </React.Fragment>
            );
        })}
    </div>
);

// =============================================================================
const StudentLogin = () => {
    const { studentLogin } = useContext(AuthContext);
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [resendTimer, setResendTimer] = useState(0);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [token, setToken] = useState('');
    const [prnInfo, setPrnInfo] = useState({ branch: null, joiningYear: null, prn: '' });

    // Profile fields
    const [fullName, setFullName] = useState('');
    const [rollNumber, setRollNumber] = useState('');
    const [branch, setBranch] = useState(''); // Manually selected branch
    const [classDiv, setClassDiv] = useState('');
    const [year, setYear] = useState('');
    const [doorNumber, setDoorNumber] = useState('');
    const [acceptedTC, setAcceptedTC] = useState(false);

    const timerRef = useRef(null);
    useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

    // ── Resend Countdown ──────────────────────────────────────────────────────
    const startResendTimer = (seconds = 60) => {
        if (timerRef.current) clearInterval(timerRef.current);
        setResendTimer(seconds);
        timerRef.current = setInterval(() => {
            setResendTimer(prev => {
                if (prev <= 1) { clearInterval(timerRef.current); timerRef.current = null; return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    // ── Step 1: Send OTP ──────────────────────────────────────────────────────
    const handleSendOTP = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/auth/student/send-otp', { email: email.toLowerCase().trim() });
            setStep(2);
            startResendTimer(res.data.resendAfter || 60);
        } catch (err) {
            const data = err.response?.data;
            setError(data?.message || 'Failed to send OTP. Please try again.');
            if (data?.resendAfter) startResendTimer(data.resendAfter);
        } finally {
            setLoading(false);
        }
    };

    // ── Step 2: Verify OTP ────────────────────────────────────────────────────
    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await api.post('/auth/student/verify-otp', {
                email: email.toLowerCase().trim(),
                otp: otp.trim()
            });
            const { token: newToken, user } = res.data;
            setToken(newToken);
            setPrnInfo({ branch: user.branch, joiningYear: user.joiningYear, prn: user.prn });
            if (user.branch) setBranch(user.branch); // Pre-select if detected
            
            if (user.profileComplete) {
                studentLogin(newToken, user);
                navigate('/student-dashboard');
            } else {
                setStep(3);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ── Step 3: Complete Profile ──────────────────────────────────────────────
    const handleCompleteProfile = async (e) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!fullName.trim() || !rollNumber.trim() || !classDiv || !year || !doorNumber.trim()) {
            setError('All fields are required.');
            return;
        }
        if (!acceptedTC) {
            setError('You must accept the Terms & Conditions to proceed.');
            return;
        }

        // Roll number validation
        const yearDigit = year === 'FY' ? '1' : (year === 'SY' ? '2' : '3');
        if (rollNumber.length !== 5 || rollNumber[0] !== yearDigit) {
            setError(`Roll number for ${year} must be 5 digits and start with ${yearDigit}.`);
            return;
        }

        setLoading(true);
        try {
            const res = await api.post(
                '/auth/student/complete-profile',
                { 
                    fullName: fullName.trim(), 
                    rollNumber: rollNumber.trim(), 
                    classDiv, 
                    year, 
                    doorNumber: doorNumber.trim(),
                    branch
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            studentLogin(token, res.data.user);
            navigate('/student-dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Division options based on year and branch
    const getDivOptions = () => {
        if (year === 'FY') {
            return Array.from({ length: 13 }, (_, i) => `FY-${i + 1}`);
        }
        if (year === 'SY' || year === 'TY') {
            const prefix = year;
            if (branch === 'CE') return Array.from({ length: 4 }, (_, i) => `${prefix}-${i + 1}`);
            if (branch === 'ENTC') return Array.from({ length: 4 }, (_, i) => `${prefix}-${i + 5}`);
            if (branch === 'IT') return Array.from({ length: 3 }, (_, i) => `${prefix}-${i + 9}`);
            if (branch === 'AIDS' || branch === 'ECE') return [`${prefix}-12`];
        }
        return [];
    };

    return (
        <div className="auth-container otp-bg">
            <div className="auth-card otp-card" style={step === 3 ? { maxWidth: 600 } : {}}>
                <div className="otp-header">
                    <div className="otp-logo">
                        <img
                            src="https://upload.wikimedia.org/wikipedia/en/thumb/7/7e/PICT_Pune_Logo.png/220px-PICT_Pune_Logo.png"
                            alt="PICT Logo"
                            style={{ width: 48, height: 48, objectFit: 'contain' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    </div>
                    <h2 className="otp-title">Student Portal</h2>
                    <p className="otp-subtitle">PICT Boys Hostel Management</p>
                </div>

                <StepIndicator currentStep={step} />

                {error && <div className="error-msg mb-4" style={{ marginTop: '1rem' }}>{error}</div>}

                {/* STEP 1 — Email */}
                {step === 1 && (
                    <form onSubmit={handleSendOTP} className="otp-form">
                        <div className="otp-step-title"><Mail size={20} /><span>Enter your PICT email</span></div>
                        <p className="otp-hint">We'll send a one-time password to your college email.</p>
                        <div className="form-group">
                            <label>College Email ID</label>
                            <input type="email" className="form-control" value={email}
                                onChange={(e) => setEmail(e.target.value)} required
                                placeholder="f24ce307@ms.pict.edu" autoComplete="email" />
                            <p className="otp-domain-hint">Must end with <strong>@ms.pict.edu</strong></p>
                        </div>
                        <button type="submit" className="btn otp-btn" disabled={loading}>
                            {loading ? 'Sending OTP...' : <><span>Send OTP</span><ArrowRight size={18} style={{ marginLeft: 8 }} /></>}
                        </button>
                    </form>
                )}

                {/* STEP 2 — OTP */}
                {step === 2 && (
                    <form onSubmit={handleVerifyOTP} className="otp-form">
                        <div className="otp-step-title"><KeyRound size={20} /><span>Enter OTP</span></div>
                        <p className="otp-hint">Code sent to <strong>{email.toLowerCase()}</strong></p>
                        <div className="form-group">
                            <input type="text" maxLength={6} className="form-control otp-input-field text-center"
                                value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                required placeholder="● ● ● ● ● ●" />
                        </div>
                        <button type="submit" className="btn otp-btn" disabled={loading || otp.length !== 6}>
                            {loading ? 'Verifying...' : <><span>Verify OTP</span><ArrowRight size={18} style={{ marginLeft: 8 }} /></>}
                        </button>
                        <div className="otp-resend mt-3 text-center">
                            {resendTimer > 0 ? <span>Resend in {resendTimer}s</span> : 
                                <button type="button" className="otp-resend-btn" onClick={() => handleSendOTP({ preventDefault: () => {} })}>Resend OTP</button>
                            }
                        </div>
                    </form>
                )}

                {/* STEP 3 — Profile */}
                {step === 3 && (
                    <form onSubmit={handleCompleteProfile} className="otp-form">
                        <div className="otp-step-title"><UserCircle size={20} /><span>Complete your profile</span></div>
                        
                        <div className="form-group">
                            <label>Full Name</label>
                            <input type="text" className="form-control" value={fullName}
                                onChange={(e) => setFullName(e.target.value)} required placeholder="First Middle Last" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Year</label>
                                <select className="form-control" value={year} onChange={(e) => { setYear(e.target.value); setBranch(prnInfo.branch || ''); setClassDiv(''); setRollNumber(''); }} required>
                                    <option value="">Select Year</option>
                                    <option value="FY">1st Year (FY)</option>
                                    <option value="SY">2nd Year (SY)</option>
                                    <option value="TY">3rd Year (TY)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Branch</label>
                                <select className="form-control" value={branch} onChange={(e) => { setBranch(e.target.value); setClassDiv(''); }} required disabled={!year}>
                                    <option value="">Select Branch</option>
                                    <option value="CE">CE</option>
                                    <option value="ENTC">ENTC</option>
                                    <option value="IT">IT</option>
                                    <option value="AIDS">AIDS</option>
                                    <option value="ECE">ECE</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Division</label>
                            <select className="form-control" value={classDiv} onChange={(e) => setClassDiv(e.target.value)} required disabled={!branch}>
                                <option value="">Select Division</option>
                                {getDivOptions().map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Roll Number</label>
                                <input type="text" className="form-control" value={rollNumber}
                                    onChange={(e) => setRollNumber(e.target.value.replace(/\D/g, '').slice(0, 5))} 
                                    required placeholder={year ? `${year === 'FY' ? '1' : (year === 'SY' ? '2' : '3')}XXXX` : "e.g. 21108"} />
                            </div>
                            <div className="form-group">
                                <label><DoorOpen size={16} /> Door Number</label>
                                <input type="text" className="form-control" value={doorNumber}
                                    onChange={(e) => setDoorNumber(e.target.value)} required placeholder="e.g. 204" />
                            </div>
                        </div>

                        {/* T&C Section */}
                        <div className="tc-container" style={{ maxHeight: '150px', overflowY: 'scroll', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem', background: '#f9fafb' }}>
                            <h4 style={{ margin: '0 0 8px 0' }}>Student Responsibilities & Room Maintenance Guidelines</h4>
                            <p>Keep your room clean, organized, and accessible at all times. Belongings must not obstruct cleaning, and items should not be left scattered on the floor, as staff are not permitted to move personal belongings.</p>
                            <p>Move large or heavy objects yourself before requesting cleaning. Staff are not authorized to handle, rearrange, or organize personal items.</p>
                            <p>Dispose of all food waste and wrappers in designated dustbins outside your room. Personal dustbins must be emptied by you, and all food must be stored properly to prevent pests and hygiene issues.</p>
                            <p>Maintain basic hygiene and ensure your room conditions do not inconvenience staff or other residents. Avoid storing open or perishable items improperly.</p>
                            <p>Ensure your room is accessible during cleaning schedules. If the room is locked or inaccessible, cleaning may be skipped. In shared rooms, all occupants share responsibility for cleanliness.</p>
                            <p>Staff are responsible only for standard cleaning tasks and not for managing personal belongings, excessive waste, or unsafe items. Treat staff with respect and cooperate during all maintenance activities.</p>
                            <h4 style={{ margin: '12px 0 8px 0' }}>Complaint Responsibility</h4>
                            <p>Complaints should be raised only after ensuring compliance with these guidelines.</p>
                            <p>Issues caused by negligence, improper room conditions, or misuse will not be considered valid.</p>
                            <p>Students may be required to provide photo evidence when submitting complaints.</p>
                            <p>False or repeated invalid complaints may result in restricted complaint privileges.</p>
                            <h4 style={{ margin: '12px 0 8px 0' }}>Important Note</h4>
                            <p>Cleaning quality depends on room condition and accessibility. Non-compliant rooms may not be cleaned thoroughly. Repeated non-compliance may lead to reduced service priority or further action.</p>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.85rem', cursor: 'pointer', marginBottom: '1.5rem' }}>
                            <input type="checkbox" checked={acceptedTC} onChange={e => setAcceptedTC(e.target.checked)} style={{ marginTop: '3px' }} />
                            <span>I have read and agree to the Student Responsibilities & Room Maintenance Guidelines.</span>
                        </label>

                        <button type="submit" className="btn otp-btn" disabled={loading || !acceptedTC}>
                            {loading ? 'Saving...' : <><span>Save &amp; Go to Dashboard</span><ArrowRight size={18} style={{ marginLeft: 8 }} /></>}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default StudentLogin;
