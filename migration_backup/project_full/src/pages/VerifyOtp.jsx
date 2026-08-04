import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function VerifyOtp() {
  const { user, loading, verifyOtp, resendOtp, otpSent, message, clearMessage } = useAuth();
  const navigate = useNavigate();
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    // If we get here and otp wasn't sent, go to login
    if (!loading && !user && !otpSent) {
      navigate('/accounts/login');
    }
  }, [otpSent, user, loading, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const res = await verifyOtp(otp);
    setSubmitting(false);
    if (res.success) {
      navigate('/dashboard');
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    await resendOtp();
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-5">
        <div className="card border-0 shadow-lg p-4 p-md-5 rounded-4 animate__animated animate__fade-in">
          <div className="text-center mb-5">
            <div className="bg-primary-subtle d-inline-block p-4 rounded-circle mb-4">
              <i className="bi bi-shield-lock display-4 text-primary"></i>
            </div>
            <h2 className="fw-bold text-dark">Verify Your Identity</h2>
            <p className="text-muted">Enter the 6-digit verification code sent to your email address.</p>
          </div>

          {message && (
            <div className="mb-4">
              <div className={`alert alert-${message.type} alert-dismissible fade show`} role="alert">
                {message.text}
                <button type="button" className="btn-close" onClick={clearMessage}></button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="needs-validation">
            <div className="mb-4 text-center">
              <label className="form-label fw-semibold mb-3">Verification Code</label>
              <input
                type="text"
                name="otp"
                maxLength="6"
                required
                autoFocus
                className="form-control form-control-lg text-center fw-bold fs-2"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                style={{
                  letterSpacing: '10px',
                  padding: '20px !important',
                  borderRadius: '12px !important'
                }}
              />
            </div>

            <div className="d-grid gap-3 mt-5">
              <button
                type="submit"
                disabled={submitting || otp.length !== 6}
                className="btn btn-primary btn-lg rounded-pill py-3 fw-bold"
              >
                {submitting ? 'Verifying...' : 'Verify and Continue'}
              </button>
              <div className="text-center mt-3">
                <p className="text-muted small mb-1">Didn't receive the code?</p>
                <a
                  href="#"
                  onClick={handleResend}
                  className="text-primary text-decoration-none fw-semibold"
                >
                  Resend New Code
                </a>
              </div>
            </div>
          </form>

          <div className="mt-4 text-center">
            <Link to="/accounts/login" className="text-muted small text-decoration-none">
              <i className="bi bi-arrow-left me-1"></i> Back to Login
            </Link>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
