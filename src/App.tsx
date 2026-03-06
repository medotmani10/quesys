import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import LandingPage from '@/pages/LandingPage';
import OnboardingPage from '@/pages/OnboardingPage';
import CustomerBookingPage from '@/pages/CustomerBookingPage';
import AdminDashboard from '@/pages/AdminDashboard';
import ArchivePage from '@/pages/ArchivePage';
import AdminSettingsPage from '@/pages/AdminSettingsPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div dir="rtl" className="min-h-[100dvh] bg-background text-foreground">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/:slug" element={<CustomerBookingPage />} />
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

export default App;
