import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';

const Register = () => {
    const { register } = useContext(AuthContext);
    const navigate = useNavigate();
    
    const [formData, setFormData] = useState({
        name: '', email: '', password: '', role: 'Student'
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsSubmitting(true);
        try {
            await register(formData.name, formData.email, formData.password, formData.role);
            setSuccess('Registration successful. You can now log in.');
            setTimeout(() => navigate('/'), 2000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to register');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                    <div className="stat-icon" style={{ width: '4rem', height: '4rem', fontSize: '2rem' }}>
                        <UserPlus />
                    </div>
                </div>
                <h2>Create Account</h2>
                
                {error && <div className="error-msg mb-4">{error}</div>}
                {success && <div className="success-msg mb-4">{success}</div>}
                
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Full Name</label>
                        <input 
                            type="text" name="name" className="form-control" 
                            onChange={handleChange} required placeholder="John Doe"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Email Address</label>
                        <input 
                            type="email" name="email" className="form-control" 
                            onChange={handleChange} required placeholder="user@example.com"
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Password</label>
                        <input 
                            type="password" name="password" className="form-control" 
                            onChange={handleChange} required placeholder="••••••••"
                        />
                    </div>

                    <div className="form-group">
                        <label>Role</label>
                        <select name="role" className="form-control" onChange={handleChange} value={formData.role}>
                            <option value="Student">Student</option>
                            <option value="Admin">Admin/Warden</option>
                        </select>
                    </div>
                    
                    <button type="submit" className="btn mt-4" disabled={isSubmitting}>
                        {isSubmitting ? 'Registering...' : 'Register'}
                    </button>
                    
                    <p className="text-center mt-4">
                        <span className="text-muted">Already have an account? </span>
                        <Link to="/" className="text-primary">Sign in</Link>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default Register;
