import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';

const Login = () => {
    const { login } = useContext(AuthContext);
    const navigate = useNavigate(); // ✅ ADD

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            const res = await login(email, password); // ✅ capture response

            const user = res?.user || JSON.parse(sessionStorage.getItem("user"));

            // 🔥 ROLE-BASED REDIRECT
            if (user?.role === "STUDENT") {
                navigate("/student-dashboard");
            } else if (user?.role === "WARDEN") {
                navigate("/admin-dashboard");
            } else if (user?.role === "STAFF") {
                navigate("/staff-dashboard");
            } else {
                navigate("/"); // fallback
            }

        } catch (err) {
            setError(err.response?.data?.message || 'Failed to login');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                    <div className="stat-icon" style={{ width: '4rem', height: '4rem', fontSize: '2rem' }}>
                        <LogIn />
                    </div>
                </div>
                <h2>Hostel Login</h2>

                {error && <div className="error-msg mb-4">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email Address</label>
                        <input 
                            type="email" 
                            className="form-control" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            required 
                            placeholder="user@example.com"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Password</label>
                        <input 
                            type="password" 
                            className="form-control" 
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                            placeholder="••••••••"
                        />
                    </div>
                    
                    <button type="submit" className="btn mt-4" disabled={isSubmitting}>
                        {isSubmitting ? 'Signing in...' : 'Sign In'}
                    </button>
                    
                    <p className="text-center mt-4">
                        <span className="text-muted">Don't have an account? </span>
                        <Link to="/register" className="text-primary">Register here</Link>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default Login;