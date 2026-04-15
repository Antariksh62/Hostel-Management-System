import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';

// Import Pages
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';

const PrivateRoute = ({ children, allowedRole }) => {
    const { user, loading } = useContext(AuthContext);

    if (loading) return <div className="loader">Loading...</div>;

    if (!user) return <Navigate to="/" />;

    if (allowedRole && user.role !== allowedRole) {
        return <Navigate to={user.role === 'Admin' ? '/admin-dashboard' : '/student-dashboard'} />;
    }

    return children;
};

const App = () => {
    const { user, loading } = useContext(AuthContext);

    if (loading) return <div className="loader">Loading...</div>;

    return (
        <Router>
            <div className="app-container">
                <main>
                    <Routes>
                        <Route path="/" element={user ? <Navigate to={user.role === 'Admin' ? '/admin-dashboard' : '/student-dashboard'} /> : <Login />} />
                        <Route path="/register" element={<Register />} />
                        
                        <Route path="/student-dashboard" element={
                            <PrivateRoute allowedRole="Student">
                                <StudentDashboard />
                            </PrivateRoute>
                        } />
                        
                        <Route path="/admin-dashboard" element={
                            <PrivateRoute allowedRole="Admin">
                                <AdminDashboard />
                            </PrivateRoute>
                        } />
                    </Routes>
                </main>
            </div>
        </Router>
    );
};

export default App;
