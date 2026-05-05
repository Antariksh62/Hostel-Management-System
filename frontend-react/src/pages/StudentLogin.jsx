import React, { useState, useContext, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { Mail, KeyRound, UserCircle, ArrowRight, RefreshCw, DoorOpen } from 'lucide-react';

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

const StudentLogin = () => {
    const { studentLogin, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [resendTimer, setResendTimer] = useState(0);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [token, setToken] = useState('');
    const [prnInfo, setPrnInfo] = useState({ branch: null, joiningYear: null, prn: '' });

    const [fullName, setFullName] = useState('');
    const [rollNumber, setRollNumber] = useState('');
    const [branch, setBranch] = useState('');
    const [classDiv, setClassDiv] = useState('');
    const [year, setYear] = useState('');
    const [doorNumber, setDoorNumber] = useState('');
    const [acceptedTC, setAcceptedTC] = useState(false);

    const timerRef = useRef(null);

    // ✅ Clean up any bad previous state when hitting the login screen
    useEffect(() => {
        logout();
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

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
            if (user.branch) setBranch(user.branch);

            // ✅ If profile is already done, send them directly to dashboard
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

    const handleCompleteProfile = async (e) => {
        e.preventDefault();
        setError('');

        if (!fullName.trim() || !rollNumber.trim() || !classDiv || !year || !doorNumber.trim()) {
            setError('All fields are required.');
            return;
        }
        if (!acceptedTC) {
            setError('You must accept the Terms & Conditions to proceed.');
            return;
        }

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
                { headers: { Authorization: `Bearer ${token}` } } // Safely passing token manually
            );

            // Log them in using AuthContext and redirect
            studentLogin(token, res.data.user);
            navigate('/student-dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const getDivOptions = () => {
        if (year === 'FY') return Array.from({ length: 13 }, (_, i) => `FY-${i + 1}`);
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
                                <button type="button" className="otp-resend-btn" onClick={() => handleSendOTP({ preventDefault: () => { } })}>Resend OTP</button>
                            }
                        </div>
                    </form>
                )}

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

                        <div className="tc-container" style={{ maxHeight: '150px', overflowY: 'scroll', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '0.8rem', marginBottom: '1rem', background: '#f9fafb' }}>
                            <h4 style={{ margin: '0 0 8px 0' }}>Student Responsibilities & Room Maintenance Guidelines</h4>
                            <p>Keep your room clean, organized, and accessible at all times...</p>
                            <p>Complaints should be raised only after ensuring compliance with these guidelines.</p>
                            <p>Any false or repeated invalid complaints may result in restricted complaint privileges and will be fined heavily.</p>
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