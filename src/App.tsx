import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import OnboardingPage from '@/pages/OnboardingPage';
import CustomerBookingPage from '@/pages/CustomerBookingPage';
import AdminDashboard from '@/pages/AdminDashboard';
import ArchivePage from '@/pages/ArchivePage';
import AdminSettingsPage from '@/pages/AdminSettingsPage';
import TicketStatusPage from '@/pages/TicketStatusPage';
import TVDisplayPage from '@/pages/TVDisplayPage';
import BarberLoginPage from '@/pages/BarberLoginPage';
import BarberDashboard from '@/pages/BarberDashboard';
import AdminInstallPrompt from '@/components/AdminInstallPrompt';
import BarberInstallPrompt from '@/components/BarberInstallPrompt';

function App() {
  const hostname = window.location.hostname;
  const isAdmin = hostname.includes('admin');
  const isBarber = hostname.includes('barber-') || hostname.includes('barber.');

  // ---------------------------------------------------------------------------
  // ADMIN ROUTES
  // ---------------------------------------------------------------------------
  if (isAdmin) {
    return (
      <BrowserRouter>
        <div dir="rtl" className="min-h-[100dvh] bg-background text-foreground">
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/archive" element={<ArchivePage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <AdminInstallPrompt />
          <Toaster position="top-center" richColors />
        </div>
      </BrowserRouter>
    );
  }

  // ---------------------------------------------------------------------------
  // BARBER ROUTES
  // ---------------------------------------------------------------------------
  if (isBarber) {
    return (
      <BrowserRouter>
        <div dir="rtl" className="min-h-[100dvh] bg-background text-foreground">
          <Routes>
            {/* Standard URLs from previous setup mapped safely */}
            <Route path="/" element={<BarberLoginPage />} />
            <Route path="/barber-entry" element={<Navigate to="/" replace />} />
            <Route path="/:slug/barber/login" element={<BarberLoginPage />} />
            <Route path="/:slug/barber" element={<BarberDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <BarberInstallPrompt />
          <Toaster position="top-center" richColors />
        </div>
      </BrowserRouter>
    );
  }

  // ---------------------------------------------------------------------------
  // CUSTOMER / MAIN ROUTES
  // ---------------------------------------------------------------------------
  return (
    <BrowserRouter>
      <div dir="rtl" className="min-h-[100dvh] bg-background text-foreground">
        <Routes>
          {/* Customer landing */}
          <Route path="/" element={<LandingPage />} />

          {/* Shared views */}
          <Route path="/t/:ticketId" element={<TicketStatusPage />} />
          <Route path="/:slug/tv" element={<TVDisplayPage />} />

          {/* Customer booking */}
          <Route path="/:slug" element={<CustomerBookingPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-center" richColors />
      </div>
    </BrowserRouter>
  );
}

export default App;
