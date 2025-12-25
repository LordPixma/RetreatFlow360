import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/admin-layout';
import LoginPage from './pages/auth/login';
import DashboardPage from './pages/dashboard';
import TenantsPage from './pages/tenants';
import TenantDetailPage from './pages/tenants/detail';
import TenantCreatePage from './pages/tenants/create';
import UsersPage from './pages/users';
import AnalyticsPage from './pages/analytics';
import BillingPage from './pages/billing';
import SystemPage from './pages/system';
import { useAuth } from './stores/auth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Only GlobalAdmin can access admin console
  if (user?.role !== 'GlobalAdmin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="mt-2 text-muted-foreground">
            You do not have permission to access the admin console.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="tenants" element={<TenantsPage />} />
        <Route path="tenants/create" element={<TenantCreatePage />} />
        <Route path="tenants/:id" element={<TenantDetailPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="system" element={<SystemPage />} />
      </Route>
    </Routes>
  );
}
