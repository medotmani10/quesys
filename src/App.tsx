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
import CustomerInstallPrompt from '@/components/CustomerInstallPrompt';
import SuperAdminLoginPage from '@/pages/SuperAdminLoginPage';
import SuperAdminDashboard from '@/pages/SuperAdminDashboard';

function App() {
  const hostname = window.location.hostname;
  const isAdmin = hostname.includes('admin') && !hostname.includes('superadmin');
  const isSuperAdmin = hostname.includes('superadmin');
  const isBarber = hostname.includes('barber-') || hostname.includes('barber.');
  const isCustomer = hostname.includes('customer') || hostname.includes('costumer');

  // ---------------------------------------------------------------------------
  // SUPERADMIN ROUTES (superadmin-barberticket.vercel.app)
  // ---------------------------------------------------------------------------
  if (isSuperAdmin) {
    return (
      <BrowserRouter>
        <div dir="rtl" className="min-h-[100dvh] bg-background text-foreground">
          <Routes>
            <Route path="/" element={<SuperAdminLoginPage />} />
            <Route path="/superadmin" element={<SuperAdminDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster position="top-center" richColors />
        </div>
      </BrowserRouter>
    );
  }

  // ---------------------------------------------------------------------------
  // ADMIN ROUTES (admin-barberticket.vercel.app)
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
  // BARBER ROUTES (barber-barberticket.vercel.app)
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
  // CUSTOMER ROUTES (customer-barberticket.vercel.app)
  // ---------------------------------------------------------------------------
  if (isCustomer) {
    return (
      <BrowserRouter>
        <div dir="rtl" className="min-h-[100dvh] bg-background text-foreground">
          <Routes>
            {/* Ticket status tracking (Specific path first) */}
            <Route path="/:slug/ticket/:ticketId" element={<TicketStatusPage />} />
            {/* Customer booking page - main route */}
            <Route path="/:slug" element={<CustomerBookingPage />} />
            {/* Legacy redirect or backup */}
            <Route path="/t/:ticketId" element={<TicketStatusPage />} />
            {/* Default redirect to a sample shop or show landing */}
            <Route path="/" element={<Navigate to="/default-slug" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <CustomerInstallPrompt />
          <Toaster position="top-center" richColors />
        </div>
      </BrowserRouter>
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN LANDING PAGE (barberticket.vercel.app)
  // ---------------------------------------------------------------------------
  return (
    <BrowserRouter>
      <div dir="rtl" className="min-h-[100dvh] bg-background text-foreground">
        <Routes>
          {/* Landing page for main domain */}
          <Route path="/" element={<LandingPage />} />
          {/* TV Display for shops */}
          <Route path="/:slug/tv" element={<TVDisplayPage />} />
          {/* Customer booking & ticket status on main domain */}
          <Route path="/:slug" element={<CustomerBookingPage />} />
          <Route path="/:slug/ticket/:ticketId" element={<TicketStatusPage />} />
          {/* Redirects */}
          <Route path="/t/:ticketId" element={<TicketStatusPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-center" richColors />
      </div>
    </BrowserRouter>
  );
}

export default App;
