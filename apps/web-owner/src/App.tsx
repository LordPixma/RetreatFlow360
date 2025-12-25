import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/dashboard-layout';
import LoginPage from './pages/auth/login';
import DashboardPage from './pages/dashboard';
import EventsPage from './pages/events';
import EventCreatePage from './pages/events/create';
import EventEditPage from './pages/events/edit';
import EventDetailPage from './pages/events/detail';
import VenuesPage from './pages/venues';
import VenueCreatePage from './pages/venues/create';
import VenueEditPage from './pages/venues/edit';
import BookingsPage from './pages/bookings';
import BookingDetailPage from './pages/bookings/detail';
import AttendeesPage from './pages/attendees';
import FinancialsPage from './pages/financials';
import SettingsPage from './pages/settings';
import { useAuth } from './stores/auth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

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
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="events/create" element={<EventCreatePage />} />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="events/:id/edit" element={<EventEditPage />} />
        <Route path="venues" element={<VenuesPage />} />
        <Route path="venues/create" element={<VenueCreatePage />} />
        <Route path="venues/:id/edit" element={<VenueEditPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="bookings/:id" element={<BookingDetailPage />} />
        <Route path="attendees" element={<AttendeesPage />} />
        <Route path="financials" element={<FinancialsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
