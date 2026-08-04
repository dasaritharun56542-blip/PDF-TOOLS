import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await axios.post('/accounts/api/password-reset/request-otp/', { email });
      if (res.data && res.data.success) {
        setMessage(res.data.message || 'OTP verification code sent.');
        setTimeout(() => {
          navigate('/accounts/reset-password-otp', { state: { email } });
        }, 1500);
      } else {
        setError(res.data.error || 'Failed to send password reset OTP.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred while sending OTP. Please try again.');
    } finally {
      setLoading(false);
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
                  <i className="bi bi-shield-lock-fill fs-2"></i>
                </div>
                <h3 className="fw-bold">Forgot Password</h3>
                <p className="text-muted small">Enter your registered email address to receive a 6-digit verification code.</p>
              </div>

              {error && <div className="alert alert-danger rounded-3 small py-2">{error}</div>}
              {message && <div className="alert alert-success rounded-3 small py-2">{message}</div>}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">Email Address</label>
                  <div className="input-group">
                    <span className="input-group-text bg-light border-end-0"><i className="bi bi-envelope text-muted"></i></span>
                    <input
                      type="email"
                      className="form-control form-control-lg border-start-0 ps-0"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary btn-lg w-100 fw-bold rounded-3 shadow-sm mb-3" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Sending Code...
                    </>
                  ) : (
                    'Send Reset Code'
                  )}
                </button>

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
