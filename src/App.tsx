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

// Detect if the app is running as an installed PWA (standalone mode)
const isPWA = window.matchMedia('(display-mode: standalone)').matches
  || (window.navigator as any).standalone === true;

function App() {
  return (
    <BrowserRouter>
      <div dir="rtl" className="min-h-[100dvh] bg-background text-foreground">
        <Routes>
          {/* Root: landing page for web, login for PWA */}
          <Route path="/" element={isPWA ? <Navigate to="/login" replace /> : <LandingPage />} />

          {/* Auth & setup — available in both modes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />

          {/* Admin routes — always accessible */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/archive" element={<ArchivePage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />

          {/* Ticket status page — QR code direct link, no auth needed, web+PWA */}
          <Route path="/t/:ticketId" element={<TicketStatusPage />} />

          {/* Customer booking page:
              - In PWA → go to admin (customers use browser link, not the installed app)
              - In browser → show the customer booking page */}
          {/* TV display page — must be BEFORE the /:slug catch-all */}
          <Route path="/:slug/tv" element={<TVDisplayPage />} />

          <Route
            path="/:slug"
            element={isPWA ? <Navigate to="/admin" replace /> : <CustomerBookingPage />}
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-center" richColors />
      </div>
    </BrowserRouter>
  );
}

export default App;
