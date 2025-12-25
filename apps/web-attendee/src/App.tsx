import { Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/toaster';
import { Layout } from '@/components/layout';
import { AuthProvider } from '@/stores/auth';

// Pages
import HomePage from '@/pages/home';
import EventsPage from '@/pages/events';
import EventDetailPage from '@/pages/events/[slug]';
import BookingPage from '@/pages/booking';
import BookingsPage from '@/pages/my-bookings';
import ProfilePage from '@/pages/profile';
import LoginPage from '@/pages/auth/login';
import RegisterPage from '@/pages/auth/register';
import ForgotPasswordPage from '@/pages/auth/forgot-password';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/:slug" element={<EventDetailPage />} />
        </Route>

        {/* Auth routes */}
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />

        {/* Protected routes */}
        <Route path="/" element={<Layout requireAuth />}>
          <Route path="booking/:eventId" element={<BookingPage />} />
          <Route path="my-bookings" element={<BookingsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Routes>
      <Toaster />
    </AuthProvider>
  );
}
