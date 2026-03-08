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
import { Scissors } from 'lucide-react';

// Fallback component for the Barber Standalone App
// The barber manifest's start_url is /barber-entry
function BarberEntryFallback() {
  const savedSlug = localStorage.getItem('barber_shop_slug');

  if (savedSlug) {
    return <Navigate to={`/${savedSlug}/barber`} replace />;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-zinc-950 text-white p-6 text-center" dir="rtl">
      <div className="w-20 h-20 bg-yellow-400/10 rounded-3xl flex items-center justify-center mb-8 border border-yellow-400/20 shadow-[0_0_30px_rgba(250,204,21,0.15)]">
        <Scissors className="w-10 h-10 text-yellow-400" />
      </div>
      <h1 className="text-3xl font-black mb-4">أهلاً بك في لوحة الحلاق</h1>
      <p className="text-zinc-400 text-lg max-w-sm mb-8">
        للدخول إلى حسابك، يرجى فتح الرابط الخاص بصالونك أولاً، وسيقوم التطبيق بتذكر صالونك في المرة القادمة تلقائياً.
      </p>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm text-zinc-500 w-full max-w-sm">
        مثال:
        <br />
        <span className="text-white font-mono mt-2 block">barberticket.com/<b>[اسم الصالون]</b>/barber/login</span>
      </div>
    </div>
  );
}

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
            <Route path="/" element={<BarberEntryFallback />} />
            <Route path="/barber-entry" element={<Navigate to="/" replace />} />
            <Route path="/:slug/barber/login" element={<BarberLoginPage />} />
            <Route path="/:slug/barber" element={<BarberDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
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
