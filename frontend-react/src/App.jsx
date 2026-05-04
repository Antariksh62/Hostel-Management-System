import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';

// Import Pages
import Login from './pages/Login';
import StudentLogin from './pages/StudentLogin';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import StaffDashboard from "./pages/StaffDashboard";

const PrivateRoute = ({ children, allowedRole }) => {
    const { user, loading } = useContext(AuthContext);

    if (loading) return <div className="loader">Loading...</div>;

    if (!user) return <Navigate to="/" />;

    if (allowedRole && user.role !== allowedRole) {
        if (user.role === 'WARDEN') return <Navigate to="/admin-dashboard" />;
        if (user.role === 'STAFF') return <Navigate to="/staff-dashboard" />;
        return <Navigate to="/student-dashboard" />;
    }

    return children;
};

const App = () => {
    const { user, loading } = useContext(AuthContext);

    if (loading) return <div className="loader">Loading...</div>;

    const getDefaultRoute = () => {
        if (!user) return '/';
        if (user.role === 'WARDEN') return '/admin-dashboard';
        if (user.role === 'STAFF') return '/staff-dashboard';
        return '/student-dashboard';
    };

    return (
        <Router>
            <div className="app-container">
                <main>
                    <Routes>
                        <Route path="/" element={user ? <Navigate to={getDefaultRoute()} /> : <Login />} />
                        <Route path="/student-login" element={user?.role === 'STUDENT' ? <Navigate to="/student-dashboard" /> : <StudentLogin />} />
                        <Route path="/register" element={<Register />} />
                        
                        <Route path="/student-dashboard" element={
                            <PrivateRoute allowedRole="STUDENT">
                                <StudentDashboard />
                            </PrivateRoute>
                        } />
                        
                        <Route path="/admin-dashboard" element={
                            <PrivateRoute allowedRole="WARDEN">
                                <AdminDashboard />
                            </PrivateRoute>
                        } />

                        <Route path="/staff-dashboard" element={
                            <PrivateRoute allowedRole="STAFF">
                                <StaffDashboard />
                            </PrivateRoute>
                        } />
                    </Routes>
                </main>
            </div>
        </Router>
    );
};

export default App;
