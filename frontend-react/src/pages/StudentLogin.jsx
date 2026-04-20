import React, { useState, useContext, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import api from '../services/api';
import { Mail, KeyRound, UserCircle, ArrowRight, RefreshCw, DoorOpen } from 'lucide-react';

// ─── Step indicators ─────────────────────────────────────────────────────────
const StepIndicator = ({ currentStep }) => (
    <div className="otp-steps">
        {['Email', 'OTP', 'Profile'].map((label, idx) => {
            const step = idx + 1;
            const isActive = step === currentStep;
            const isDone = step < currentStep;
            return (
                <React.Fragment key={step}>
                    <div className={`otp-step ${isActive ? 'otp-step--active' : ''} ${isDone ? 'otp-step--done' : ''}`}>
                        <div className="otp-step-circle">
                            {isDone ? '✓' : step}
                        </div>
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

    const [step, setStep] = useState(1);            // 1, 2, 3
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [resendTimer, setResendTimer] = useState(0);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [token, setToken] = useState('');         // Temp token after OTP

    // Profile fields
    const [fullName, setFullName] = useState('');
    const [rollNumber, setRollNumber] = useState('');
    const [classDiv, setClassDiv] = useState('');
    const [year, setYear] = useState('');
    const [doorNumber, setDoorNumber] = useState('');

    // Ref to track the resend countdown interval (prevents leaks on rapid resends)
    const timerRef = useRef(null);

    // Clear the interval when the component unmounts
    useEffect(() => {
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    // ─── Countdown timer for resend ──────────────────────────────────────────
    const startResendTimer = () => {
        // Clear any existing interval before starting a fresh one
        if (timerRef.current) clearInterval(timerRef.current);
        setResendTimer(60);
        timerRef.current = setInterval(() => {
            setResendTimer(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    // ─── Step 1: Send OTP ────────────────────────────────────────────────────
    const handleSendOTP = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.post('/auth/student/send-otp', { email: email.toLowerCase().trim() });
            setStep(2);
            startResendTimer();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ─── Step 2: Verify OTP ──────────────────────────────────────────────────
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

            if (user.profileComplete) {
                // Already has profile → go straight to dashboard
                studentLogin(newToken, user);
                navigate('/student-dashboard');
            } else {
                // First time → show profile form
                setStep(3);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ─── Resend OTP ──────────────────────────────────────────────────────────
    const handleResend = async () => {
        setError('');
        setOtp('');
        setLoading(true);
        try {
            await api.post('/auth/student/send-otp', { email: email.toLowerCase().trim() });
            startResendTimer();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to resend OTP.');
        } finally {
            setLoading(false);
        }
    };

    // ─── Step 3: Complete Profile ─────────────────────────────────────────────
    const handleCompleteProfile = async (e) => {
        e.preventDefault();
        setError('');

        // Client-side trim validation (catches whitespace-only inputs that bypass `required`)
        if (!fullName.trim() || !rollNumber.trim() || !classDiv || !year || !doorNumber.trim()) {
            setError('All fields are required and cannot be blank.');
            return;
        }

        setLoading(true);
        try {
            // Temporarily attach token so this protected call works
            const res = await api.post('/auth/student/complete-profile',
                {
                    fullName: fullName.trim(),
                    rollNumber: rollNumber.trim(),
                    classDiv,
                    year,
                    doorNumber: doorNumber.trim()
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            const updatedUser = res.data.user;
            studentLogin(token, updatedUser);
            navigate('/student-dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container otp-bg">
            <div className="auth-card otp-card">

                {/* Logo / Header */}
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

                {/* ═══ STEP 1 — Email ═══════════════════════════════════════ */}
                {step === 1 && (
                    <form onSubmit={handleSendOTP} className="otp-form">
                        <div className="otp-step-title">
                            <Mail size={20} />
                            <span>Enter your PICT email</span>
                        </div>
                        <p className="otp-hint">We'll send a one-time password to your college email.</p>
                        <div className="form-group">
                            <label>College Email ID</label>
                            <input
                                id="student-email"
                                type="email"
                                className="form-control"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="f24ce307@ms.pict.edu"
                                autoComplete="email"
                            />
                            <p className="otp-domain-hint">Must end with <strong>@ms.pict.edu</strong></p>
                        </div>
                        <button id="send-otp-btn" type="submit" className="btn otp-btn" disabled={loading}>
                            {loading ? 'Sending OTP...' : <>Send OTP <ArrowRight size={18} style={{ marginLeft: 8 }} /></>}
                        </button>
                        <p className="text-center mt-4">
                            <span className="text-muted">Staff or Warden? </span>
                            <Link to="/" className="text-primary">Login here</Link>
                        </p>
                    </form>
                )}

                {/* ═══ STEP 2 — OTP ════════════════════════════════════════ */}
                {step === 2 && (
                    <form onSubmit={handleVerifyOTP} className="otp-form">
                        <div className="otp-step-title">
                            <KeyRound size={20} />
                            <span>Enter OTP</span>
                        </div>
                        <p className="otp-hint">
                            A 6-digit code was sent to <strong>{email.toLowerCase()}</strong>
                        </p>
                        <div className="form-group">
                            <label>One-Time Password</label>
                            <input
                                id="otp-input"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]{6}"
                                maxLength={6}
                                className="form-control otp-input-field"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                required
                                placeholder="● ● ● ● ● ●"
                                autoComplete="one-time-code"
                            />
                        </div>
                        <button id="verify-otp-btn" type="submit" className="btn otp-btn" disabled={loading || otp.length !== 6}>
                            {loading ? 'Verifying...' : <>Verify OTP <ArrowRight size={18} style={{ marginLeft: 8 }} /></>}
                        </button>
                        <div className="otp-resend">
                            {resendTimer > 0 ? (
                                <span className="text-muted">Resend in {resendTimer}s</span>
                            ) : (
                                <button type="button" className="otp-resend-btn" onClick={handleResend} disabled={loading}>
                                    <RefreshCw size={14} style={{ marginRight: 4 }} /> Resend OTP
                                </button>
                            )}
                        </div>
                        <button type="button" className="otp-back-btn" onClick={() => { setStep(1); setOtp(''); setError(''); }}>
                            ← Change email
                        </button>
                    </form>
                )}

                {/* ═══ STEP 3 — Profile ════════════════════════════════════ */}
                {step === 3 && (
                    <form onSubmit={handleCompleteProfile} className="otp-form">
                        <div className="otp-step-title">
                            <UserCircle size={20} />
                            <span>Complete your profile</span>
                        </div>
                        <p className="otp-hint">This info will be saved to your account — you won't need to enter it again.</p>

                        <div className="form-group">
                            <label>Full Name</label>
                            <input id="full-name" type="text" className="form-control" value={fullName}
                                onChange={(e) => setFullName(e.target.value)} required placeholder="e.g. Antariksh Kulkarni" />
                        </div>
                        <div className="form-group">
                            <label>Roll Number</label>
                            <input id="roll-number" type="text" className="form-control" value={rollNumber}
                                onChange={(e) => setRollNumber(e.target.value)} required placeholder="e.g. 307" />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label>Class & Division</label>
                                <select id="class-div" className="form-control" value={classDiv}
                                    onChange={(e) => setClassDiv(e.target.value)} required>
                                    <option value="">Select</option>
                                    <option value="CE-A">CE-A</option>
                                    <option value="CE-B">CE-B</option>
                                    <option value="CE-C">CE-C</option>
                                    <option value="CE-D">CE-D</option>
                                    <option value="IT-A">IT-A</option>
                                    <option value="IT-B">IT-B</option>
                                    <option value="IT-C">IT-C</option>
                                    <option value="ENTC-A">ENTC-A</option>
                                    <option value="ENTC-B">ENTC-B</option>
                                    <option value="MECH-A">MECH-A</option>
                                    <option value="MECH-B">MECH-B</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Year</label>
                                <select id="year-select" className="form-control" value={year}
                                    onChange={(e) => setYear(e.target.value)} required>
                                    <option value="">Select</option>
                                    <option value="FY">FY (First Year)</option>
                                    <option value="SY">SY (Second Year)</option>
                                    <option value="TY">TY (Third Year)</option>
                                    <option value="Final Year">Final Year (BTech)</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>
                                <DoorOpen size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                                Hostel Door Number
                            </label>
                            <input id="door-number" type="text" className="form-control" value={doorNumber}
                                onChange={(e) => setDoorNumber(e.target.value)} required placeholder="e.g. B-204 or Room 14" />
                            <p className="otp-domain-hint">This will automatically appear on all your complaints.</p>
                        </div>

                        <button id="complete-profile-btn" type="submit" className="btn otp-btn" disabled={loading}>
                            {loading ? 'Saving...' : <>Save & Go to Dashboard <ArrowRight size={18} style={{ marginLeft: 8 }} /></>}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default StudentLogin;
