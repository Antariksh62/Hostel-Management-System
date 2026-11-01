const fs = require("fs");
const path = require("path");

// 1. Update vite.config.js
const viteConfigFile = path.join(__dirname, "../frontend-react/vite.config.js");
let viteConfig = fs.readFileSync(viteConfigFile, "utf8");
const isViteCRLF = viteConfig.includes("\r\n");
viteConfig = viteConfig.replace(/\r\n/g, "\n");

const oldServerConfig = `  server: {
    port: 5173,
    strictPort: true,   // fail loudly instead of silently bumping to 5174
  },`;

const newBuildAndServerConfig = `  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge'],
          'vendor-charts': ['recharts']
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true,   // fail loudly instead of silently bumping to 5174
  },`;

viteConfig = viteConfig.replace(oldServerConfig, newBuildAndServerConfig);
if (isViteCRLF) viteConfig = viteConfig.replace(/\n/g, "\r\n");
fs.writeFileSync(viteConfigFile, viteConfig, "utf8");
console.log("vite.config.js successfully optimized with manualChunks!");

// 2. Update App.jsx with React.lazy
const appFile = path.join(__dirname, "../frontend-react/src/App.jsx");
let appCode = fs.readFileSync(appFile, "utf8");
const isAppCRLF = appCode.includes("\r\n");
appCode = appCode.replace(/\r\n/g, "\n");

const oldImports = `// Protected Incharge / HOIDSS Dashboard (CRITICAL PROTECTED INFRASTRUCTURE)
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
import StaffHeatmap from './pages/staff/StaffHeatmap';
import StaffHistory from './pages/staff/StaffHistory';
import StaffProfile from './pages/staff/StaffProfile';

// Migrated Warden Portal
import WardenLayout from './pages/warden/WardenLayout';
import WardenOverview from './pages/warden/WardenOverview';
import WardenComplaints from './pages/warden/WardenComplaints';
import WardenRooms from './pages/warden/WardenRooms';
import WardenStaff from './pages/warden/WardenStaff';
import WardenServiceMonitor from './pages/warden/WardenServiceMonitor';
import ResidentManagement from './pages/residents/ResidentManagement';
import HeadWardenLayout from './pages/headwarden/HeadWardenLayout';
import StaffPerformanceAnalytics from './components/analytics/StaffPerformanceAnalytics';
const StudentAdmissionModule = React.lazy(() => import('./components/admissions/StudentAdmissionModule'));

// Dedicated Wi-Fi In-Charge Dashboard
import WifiInchargeDashboard from './pages/wifi/WifiInchargeDashboard';`;

const newLazyImports = `// Code-Split Lazy Loaded Dashboard & Module Components
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
const WifiInchargeDashboard = React.lazy(() => import('./pages/wifi/WifiInchargeDashboard'));`;

appCode = appCode.replace(oldImports, newLazyImports);

// Wrap Routes in Suspense fallback
const oldRouterContent = `<Router>
                    <Routes>`;

const newRouterContent = `<Router>
                    <React.Suspense fallback={
                        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500">
                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                            <span className="text-sm font-medium">Loading view...</span>
                        </div>
                    }>
                        <Routes>`;

appCode = appCode.replace(oldRouterContent, newRouterContent);

const oldRouterClose = `</Routes>
                    <Toaster richColors position="top-right" />
                </Router>`;

const newRouterClose = `</Routes>
                    </React.Suspense>
                    <Toaster richColors position="top-right" />
                </Router>`;

appCode = appCode.replace(oldRouterClose, newRouterClose);

if (isAppCRLF) appCode = appCode.replace(/\n/g, "\r\n");
fs.writeFileSync(appFile, appCode, "utf8");
console.log("App.jsx successfully optimized with React.lazy and Suspense boundaries!");

