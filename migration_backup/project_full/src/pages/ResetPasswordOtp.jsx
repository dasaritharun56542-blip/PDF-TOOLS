import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

export default function ResetPasswordOtp() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email || '');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [timer, setTimer] = useState(60);

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!email || !otp) {
      setError('Please provide your email and 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await axios.post('/accounts/api/password-reset/verify-otp/', { email, otp });
      if (res.data && res.data.success) {
        navigate('/accounts/reset-password-new', {
          state: { email, reset_token: res.data.reset_token }
        });
      } else {
        setError(res.data.error || 'Invalid OTP code.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed. Please check your OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    setError('');
    setMessage('');

    try {
      const res = await axios.post('/accounts/api/password-reset/request-otp/', { email });
      if (res.data && res.data.success) {
        setMessage('A new OTP verification code has been sent.');
        setTimer(60);
      } else {
        setError(res.data.error || 'Failed to resend code.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend OTP.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-5 col-lg-4">
          <div className="card border-0 shadow-lg rounded-4 overflow-hidden">
            <div className="card-body p-4 p-md-5">
              <div className="text-center mb-4">
                <div className="bg-primary-subtle text-primary rounded-circle d-inline-flex p-3 mb-3">
                  <i className="bi bi-key-fill fs-2"></i>
                </div>
                <h3 className="fw-bold">Verify Reset Code</h3>
                <p className="text-muted small">Enter the 6-digit OTP code sent to <strong>{email || 'your email'}</strong></p>
              </div>

              {error && <div className="alert alert-danger rounded-3 small py-2">{error}</div>}
              {message && <div className="alert alert-success rounded-3 small py-2">{message}</div>}

              <form onSubmit={handleVerify}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Email Address</label>
                  <input
                    type="email"
                    className="form-control form-control-lg"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="form-label fw-semibold">6-Digit Verification Code</label>
                  <input
                    type="text"
                    maxLength="6"
                    className="form-control form-control-lg text-center fw-bold fs-4 tracking-wider"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary btn-lg w-100 fw-bold rounded-3 shadow-sm mb-3" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Verifying Code...
                    </>
                  ) : (
                    'Verify & Continue'
                  )}
                </button>

                <div className="text-center mb-3">
                  {timer > 0 ? (
                    <span className="text-muted small">Resend code in {timer}s</span>
                  ) : (
                    <button type="button" className="btn btn-link p-0 text-decoration-none small" onClick={handleResend} disabled={resending}>
                      {resending ? 'Resending...' : 'Resend OTP Code'}
                    </button>
                  )}
                </div>

                <div className="text-center">
                  <Link to="/accounts/login" className="text-decoration-none text-muted small">
                    <i className="bi bi-arrow-left me-1"></i> Back to Login
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
