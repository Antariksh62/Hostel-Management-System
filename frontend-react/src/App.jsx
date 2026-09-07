import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/sonner';
import { AuthContext } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30, // 30 seconds
    },
  },
});

// Authentication Pages
import Login from './pages/Login';
import StudentLogin from './pages/StudentLogin';
import Register from './pages/Register';

// Protected Incharge / HOIDSS Dashboard (CRITICAL PROTECTED INFRASTRUCTURE)
import InchargeDashboard from './pages/InchargeDashboard';

// Migrated Student Portal
import StudentLayout from './pages/student/StudentLayout';
import StudentHome from './pages/student/StudentHome';
import StudentComplaints from './pages/student/StudentComplaints';
import StudentRoom from './pages/student/StudentRoom';
import StudentProfile from './pages/student/StudentProfile';

// Migrated Staff Portal
import StaffLayout from './pages/staff/StaffLayout';
import StaffWork from './pages/staff/StaffWork';
import StaffHistory from './pages/staff/StaffHistory';
import StaffProfile from './pages/staff/StaffProfile';

// Migrated Warden Portal
import WardenLayout from './pages/warden/WardenLayout';
import WardenOverview from './pages/warden/WardenOverview';
import WardenComplaints from './pages/warden/WardenComplaints';
import WardenRooms from './pages/warden/WardenRooms';
import WardenStaff from './pages/warden/WardenStaff';

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
            <SocketProvider>
                <Router>
                    <Routes>
                        {/* Auth Entry */}
                        <Route path="/" element={user ? <Navigate to={getDefaultRoute()} /> : <Login />} />
                        <Route path="/student-login" element={user ? <Navigate to={getDefaultRoute()} /> : <StudentLogin />} />
                        <Route path="/register" element={<Register />} />
                        
                        {/* Student Portal (Nested subroutes) */}
                        <Route path="/student-dashboard" element={
                            <PrivateRoute allowedRoles={['STUDENT']}>
                                <StudentLayout />
                            </PrivateRoute>
                        }>
                            <Route index element={<StudentHome />} />
                            <Route path="complaints" element={<StudentComplaints />} />
                            <Route path="room" element={<StudentRoom />} />
                            <Route path="profile" element={<StudentProfile />} />
                        </Route>

                        {/* Warden Portal (Nested subroutes) */}
                        <Route path="/admin-dashboard" element={
                            <PrivateRoute allowedRoles={['WARDEN']}>
                                <WardenLayout />
                            </PrivateRoute>
                        }>
                            <Route index element={<WardenOverview />} />
                            <Route path="complaints" element={<WardenComplaints />} />
                            <Route path="rooms" element={<WardenRooms />} />
                            <Route path="staff" element={<WardenStaff />} />
                        </Route>

                        {/* Staff Portal (Nested subroutes) */}
                        <Route path="/staff-dashboard" element={
                            <PrivateRoute allowedRoles={['STAFF']}>
                                <StaffLayout />
                            </PrivateRoute>
                        }>
                            <Route index element={<StaffWork />} />
                            <Route path="history" element={<StaffHistory />} />
                            <Route path="profile" element={<StaffProfile />} />
                        </Route>

                        {/* Route aliases */}
                        <Route path="/student/*" element={<Navigate to="/student-dashboard" replace />} />
                        <Route path="/warden/*" element={<Navigate to="/admin-dashboard" replace />} />
                        <Route path="/staff/*" element={<Navigate to="/staff-dashboard" replace />} />

                        {/* Incharge / HOIDSS Portal (PROTECTED) */}
                        <Route path="/incharge-dashboard" element={
                            <PrivateRoute allowedRoles={['INCHARGE', 'HEADWARDEN']}>
                                <InchargeDashboard />
                            </PrivateRoute>
                        } />
                        <Route path="/headwarden-dashboard" element={<Navigate to="/incharge-dashboard" replace />} />
                    </Routes>
                    <Toaster richColors position="top-right" />
                </Router>
            </SocketProvider>
        </QueryClientProvider>
    );
};

export default App;
