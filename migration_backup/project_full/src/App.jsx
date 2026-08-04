import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyOtp from './pages/VerifyOtp';
import Pricing from './pages/Pricing';
import UpiPayment from './pages/UpiPayment';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentCancel from './pages/PaymentCancel';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import ToolDetail from './pages/ToolDetail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPasswordOtp from './pages/ResetPasswordOtp';
import ResetPasswordNew from './pages/ResetPasswordNew';
import TermsAndConditions from './pages/TermsAndConditions';
import RefundPolicy from './pages/RefundPolicy';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Contact from './pages/Contact';

function MainLayout({ children }) {
  return (
    <>
      <Navbar />
      <main className="container-fluid py-5">
        {children}
      </main>
      <Footer />
    </>
  );
}

function AdminRedirect() {
  React.useEffect(() => {
    window.location.href = '/admin/';
  }, []);
  return (
    <div className="container py-5 text-center">
      <div className="spinner-border text-primary" role="status"></div>
      <p className="mt-2 text-muted">Redirecting to Admin Portal...</p>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Admin Routes */}
          <Route path="/admin" element={<AdminRedirect />} />
          <Route path="/admin/*" element={<AdminRedirect />} />

          {/* Main Pages with standard layout */}
          <Route path="/" element={<MainLayout><Home /></MainLayout>} />
          <Route path="/accounts/login" element={<MainLayout><Login /></MainLayout>} />
          <Route path="/accounts/signup" element={<MainLayout><Signup /></MainLayout>} />
          <Route path="/accounts/verify-otp" element={<MainLayout><VerifyOtp /></MainLayout>} />
          <Route path="/accounts/forgot-password" element={<MainLayout><ForgotPassword /></MainLayout>} />
          <Route path="/accounts/reset-password-otp" element={<MainLayout><ResetPasswordOtp /></MainLayout>} />
          <Route path="/accounts/reset-password-new" element={<MainLayout><ResetPasswordNew /></MainLayout>} />
          <Route path="/accounts/pricing" element={<MainLayout><Pricing /></MainLayout>} />
          <Route path="/accounts/setup-upi" element={<MainLayout><UpiPayment /></MainLayout>} />
          <Route path="/accounts/payment-success" element={<MainLayout><PaymentSuccess /></MainLayout>} />
          <Route path="/accounts/payment-cancel" element={<MainLayout><PaymentCancel /></MainLayout>} />
          <Route path="/dashboard" element={<MainLayout><Dashboard /></MainLayout>} />
          <Route path="/history" element={<MainLayout><History /></MainLayout>} />
          
          {/* Legal & Policy Pages */}
          <Route path="/terms" element={<MainLayout><TermsAndConditions /></MainLayout>} />
          <Route path="/refund-policy" element={<MainLayout><RefundPolicy /></MainLayout>} />
          <Route path="/privacy-policy" element={<MainLayout><PrivacyPolicy /></MainLayout>} />
          <Route path="/contact" element={<MainLayout><Contact /></MainLayout>} />

          {/* Tool Pages */}
          <Route path="/tool/:toolSlug" element={<MainLayout><ToolDetail /></MainLayout>} />

          {/* Fallback */}
          <Route path="*" element={<MainLayout><Home /></MainLayout>} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}
