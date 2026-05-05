import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, GraduationCap, ShieldCheck } from 'lucide-react';

const Login = () => {
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            const res = await login(email, password);

            const user = res?.user || JSON.parse(sessionStorage.getItem("user"));

            if (user?.role === "STUDENT") {
                navigate("/student-dashboard");
            } else if (user?.role === "WARDEN") {
                navigate("/admin-dashboard");
            } else if (user?.role === "STAFF") {
                navigate("/staff-dashboard");
            } else {
                navigate("/");
            }

        } catch (err) {
            setError(err.response?.data?.message || 'Failed to login');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: 440 }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                    <div className="stat-icon" style={{ width: '4rem', height: '4rem', fontSize: '2rem' }}>
                        <ShieldCheck />
                    </div>
                </div>
                <h2>Staff / Warden Login</h2>
                <p className="text-muted text-center" style={{ marginTop: '-1rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                    For hostel management staff only
                </p>

                {error && <div className="error-msg mb-4">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input
                            id="staff-email"
                            type="email"
                            className="form-control"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="staff@pict.edu"
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            id="staff-password"
                            type="password"
                            className="form-control"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                        />
                    </div>

                    <button id="staff-login-btn" type="submit" className="btn mt-4" disabled={isSubmitting}>
                        <LogIn size={18} style={{ marginRight: 8 }} />
                        {isSubmitting ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <div className="login-divider">
                    <span>or</span>
                </div>

                <Link to="/student-login" id="student-login-link" className="student-login-btn">
                    <GraduationCap size={20} style={{ marginRight: 8 }} />
                    Student Login (PICT Email OTP)
                </Link>

                <p className="text-center mt-4">
                    <span className="text-muted">Need an account? </span>
                    <Link to="/register" className="text-primary">Register here</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;