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

// Code-Split Lazy Loaded Dashboard & Module Components
const InchargeDashboard = React.lazy(() => import('./pages/InchargeDashboard'));

const StudentLayout = React.lazy(() => import('./pages/student/StudentLayout'));
const StudentHome = React.lazy(() => import('./pages/student/StudentHome'));
const StudentComplaints = React.lazy(() => import('./pages/student/StudentComplaints'));
const StudentRoom = React.lazy(() => import('./pages/student/StudentRoom'));
const StudentProfile = React.lazy(() => import('./pages/student/StudentProfile'));

const StaffLayout = React.lazy(() => import('./pages/staff/StaffLayout'));
const StaffWork = React.lazy(() => import('./pages/staff/StaffWork'));
const StaffHeatmap = React.lazy(() => import('./pages/staff/StaffHeatmap'));
const StaffHistory = React.lazy(() => import('./pages/staff/StaffHistory'));
const StaffProfile = React.lazy(() => import('./pages/staff/StaffProfile'));

const WardenLayout = React.lazy(() => import('./pages/warden/WardenLayout'));
const WardenOverview = React.lazy(() => import('./pages/warden/WardenOverview'));
const WardenComplaints = React.lazy(() => import('./pages/warden/WardenComplaints'));
const WardenRooms = React.lazy(() => import('./pages/warden/WardenRooms'));
const WardenStaff = React.lazy(() => import('./pages/warden/WardenStaff'));
const WardenServiceMonitor = React.lazy(() => import('./pages/warden/WardenServiceMonitor'));
const ResidentManagement = React.lazy(() => import('./pages/residents/ResidentManagement'));
const HeadWardenLayout = React.lazy(() => import('./pages/headwarden/HeadWardenLayout'));
const StaffPerformanceAnalytics = React.lazy(() => import('./components/analytics/StaffPerformanceAnalytics'));
const StudentAdmissionModule = React.lazy(() => import('./components/admissions/StudentAdmissionModule'));
const WifiInchargeDashboard = React.lazy(() => import('./pages/wifi/WifiInchargeDashboard'));
const MainAdminDashboard = React.lazy(() => import('./pages/admin/MainAdminDashboard'));
const SecurityDashboard = React.lazy(() => import('./pages/security/SecurityDashboard'));
const AntiRaggingDashboard = React.lazy(() => import('./pages/antiragging/AntiRaggingDashboard'));

const PrivateRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useContext(AuthContext);

    if (loading) return <div className="loader">Loading...</div>;

    if (!user) return <Navigate to="/" />;

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        if (user.role === 'MAIN_ADMIN') return <Navigate to="/main-admin-dashboard" />;
        if (user.role === 'WIFI_INCHARGE') return <Navigate to="/wifi-dashboard" />;
        if (user.role === 'HEADWARDEN') return <Navigate to="/headwarden-dashboard" />;
        if (user.role === 'INCHARGE') return <Navigate to="/incharge-dashboard" />;
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
        if (user.role === 'MAIN_ADMIN') return '/main-admin-dashboard';
        if (user.role === 'WIFI_INCHARGE') return '/wifi-dashboard';
        if (user.role === 'HEADWARDEN') return '/headwarden-dashboard';
        if (user.role === 'INCHARGE') return '/incharge-dashboard';
        if (user.role === 'WARDEN')   return '/admin-dashboard';
        if (user.role === 'STAFF')    return '/staff-dashboard';
        return '/student-dashboard';
    };

    return (
        <QueryClientProvider client={queryClient}>
            <SocketProvider>
                <Router>
                    <React.Suspense fallback={
                        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                            <span className="text-sm font-medium">Loading view...</span>
                        </div>
                    }>
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

                        {/* Head Warden Portal (EXCLUSIVE TO HEADWARDEN) */}
                        <Route path="/headwarden-dashboard" element={
                            <PrivateRoute allowedRoles={['HEADWARDEN']}>
                                <HeadWardenLayout />
                            </PrivateRoute>
                        }>
                            <Route index element={<WardenOverview />} />
                            <Route path="admissions" element={
                                <React.Suspense fallback={<div className="p-8 text-center text-slate-500 font-medium">Loading Student Admissions Module...</div>}>
                                    <StudentAdmissionModule />
                                </React.Suspense>
                            } />
                            <Route path="complaints" element={<WardenComplaints />} />
                            <Route path="residents" element={<ResidentManagement />} />
                            <Route path="rooms" element={<WardenRooms />} />
                            <Route path="staff" element={<WardenStaff />} />
                            <Route path="services" element={<WardenServiceMonitor />} />
                            <Route path="staff-performance" element={<StaffPerformanceAnalytics />} />
                        </Route>

                        {/* Warden & In-Charge Portal (Nested subroutes) */}
                        <Route path="/admin-dashboard" element={
                            <PrivateRoute allowedRoles={['WARDEN', 'INCHARGE']}>
                                <WardenLayout />
                            </PrivateRoute>
                        }>
                            <Route index element={<WardenOverview />} />
                            <Route path="complaints" element={<WardenComplaints />} />
                            <Route path="residents" element={<ResidentManagement />} />
                            <Route path="rooms" element={<WardenRooms />} />
                            <Route path="staff" element={<WardenStaff />} />
                            <Route path="services" element={<WardenServiceMonitor />} />
                            <Route path="staff-performance" element={<StaffPerformanceAnalytics />} />
                        </Route>

                        {/* Staff Portal (Nested subroutes) */}
                        <Route path="/staff-dashboard" element={
                            <PrivateRoute allowedRoles={['STAFF']}>
                                <StaffLayout />
                            </PrivateRoute>
                        }>
                            <Route index element={<StaffWork />} />
                            <Route path="heatmap" element={<StaffHeatmap />} />
                            <Route path="history" element={<StaffHistory />} />
                            <Route path="profile" element={<StaffProfile />} />
                        </Route>

                        {/* Dedicated Wi-Fi In-Charge Specialist Portal */}
                        <Route path="/main-admin-dashboard" element={
                            <PrivateRoute allowedRoles={['MAIN_ADMIN']}>
                                <MainAdminDashboard />
                            </PrivateRoute>
                        } />

                        <Route path="/security-dashboard" element={
                            <PrivateRoute allowedRoles={['MAIN_ADMIN', 'INCHARGE', 'HEADWARDEN', 'STAFF']}>
                                <SecurityDashboard />
                            </PrivateRoute>
                        } />

                        <Route path="/anti-ragging-dashboard" element={
                            <PrivateRoute allowedRoles={['MAIN_ADMIN', 'INCHARGE', 'STAFF']}>
                                <AntiRaggingDashboard />
                            </PrivateRoute>
                        } />

                        <Route path="/wifi-dashboard" element={
                            <PrivateRoute allowedRoles={['WIFI_INCHARGE', 'WARDEN', 'HEADWARDEN', 'INCHARGE']}>
                                <WifiInchargeDashboard />
                            </PrivateRoute>
                        } />

                        {/* Route aliases */}
                        <Route path="/student/*" element={<Navigate to="/student-dashboard" replace />} />
                        <Route path="/warden/*" element={<Navigate to="/admin-dashboard" replace />} />
                        <Route path="/headwarden/*" element={<Navigate to="/headwarden-dashboard" replace />} />
                        <Route path="/staff/*" element={<Navigate to="/staff-dashboard" replace />} />
                        <Route path="/wifi/*" element={<Navigate to="/wifi-dashboard" replace />} />

                        {/* Incharge / HOIDSS Portal (PROTECTED) */}
                        <Route path="/incharge-dashboard" element={
                            <PrivateRoute allowedRoles={['INCHARGE']}>
                                <InchargeDashboard />
                            </PrivateRoute>
                        } />
                        <Route path="/incharge-dashboard/admissions" element={
                            <PrivateRoute allowedRoles={['INCHARGE']}>
                                <InchargeDashboard />
                            </PrivateRoute>
                        } />
                    </Routes>
                    </React.Suspense>
                    <Toaster richColors position="top-right" />
                </Router>
            </SocketProvider>
        </QueryClientProvider>
    );
};

export default App;
