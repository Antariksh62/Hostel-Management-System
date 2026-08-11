import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from './context/AuthContext';

const queryClient = new QueryClient();

// Import Pages
import Login from './pages/Login';
import StudentLogin from './pages/StudentLogin';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import StaffDashboard from "./pages/StaffDashboard";
import InchargeDashboard from './pages/InchargeDashboard';

const PrivateRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useContext(AuthContext);

    if (loading) return <div className="loader">Loading...</div>;

    if (!user) return <Navigate to="/" />;

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        if (user.role === 'INCHARGE' || user.role === 'HEADWARDEN') return <Navigate to="/incharge-dashboard" />;
        if (user.role === 'WARDEN')   return <Navigate to="/admin-dashboard" />;
        if (user.role === 'STAFF')    return <Navigate to="/staff-dashboard" />;
        return <Navigate to="/student-dashboard" />;
    }

    return children;
};

const App = () => {
    const { user, loading } = useContext(AuthContext);

    if (loading) return <div className="loader">Loading...</div>;

    const getDefaultRoute = () => {
        if (!user) return '/';
        if (user.role === 'INCHARGE' || user.role === 'HEADWARDEN') return '/incharge-dashboard';
        if (user.role === 'WARDEN')   return '/admin-dashboard';
        if (user.role === 'STAFF')    return '/staff-dashboard';
        return '/student-dashboard';
    };

    return (
        <QueryClientProvider client={queryClient}>
            <Router>
                <Routes>
                    <Route path="/" element={user ? <Navigate to={getDefaultRoute()} /> : <Login />} />
                    <Route path="/student-login" element={user ? <Navigate to={getDefaultRoute()} /> : <StudentLogin />} />
                    <Route path="/register" element={<Register />} />
                    
                    <Route path="/student-dashboard" element={
                        <PrivateRoute allowedRoles={['STUDENT']}>
                            <StudentDashboard />
                        </PrivateRoute>
                    } />
                    
                    <Route path="/admin-dashboard" element={
                        <PrivateRoute allowedRoles={['WARDEN']}>
                            <AdminDashboard />
                        </PrivateRoute>
                    } />

                    <Route path="/staff-dashboard" element={
                        <PrivateRoute allowedRoles={['STAFF']}>
                            <StaffDashboard />
                        </PrivateRoute>
                    } />

                    <Route path="/incharge-dashboard" element={
                        <PrivateRoute allowedRoles={['INCHARGE', 'HEADWARDEN']}>
                            <InchargeDashboard />
                        </PrivateRoute>
                    } />
                    {/* headwarden-dashboard redirects to incharge-dashboard — no separate page */}
                    <Route path="/headwarden-dashboard" element={<Navigate to="/incharge-dashboard" replace />} />
                </Routes>
            </Router>
        </QueryClientProvider>
    );
};

export default App;
