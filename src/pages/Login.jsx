import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, loading, login, otpSent, message, clearMessage, googleClientId, googleScriptLoaded, loginWithGoogle, checkAuthStatus } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleLogin = async (e) => {
    if (e) e.preventDefault();
    clearMessage();
    setSubmitting(true);
    let activeClientId = googleClientId || import.meta.env.VITE_GOOGLE_CLIENT_ID || '635971381104-v3q2u69tim8oihrjrrcispfsvhjsjim4.apps.googleusercontent.com';
    if (!activeClientId) {
      try {
        const data = await checkAuthStatus();
        if (data && data.google_client_id) {
          activeClientId = data.google_client_id;
        }
      } catch (err) {}
    }

    if (window.google?.accounts?.oauth2) {
      try {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: activeClientId,
          scope: 'profile email openid',
          callback: async (response) => {
            const token = response.access_token || response.credential || response.id_token;
            if (token) {
              const res = await loginWithGoogle(token);
              setSubmitting(false);
              if (res.success) {
                navigate('/dashboard');
              }
            } else {
              setSubmitting(false);
              if (response.error && response.error !== 'popup_closed_by_user') {
                const backendUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
                window.location.href = `${backendUrl}/accounts/google/login/?process=login`;
              }
            }
          },
          error_callback: (err) => {
            setSubmitting(false);
            if (err?.type !== 'popup_closed') {
              const backendUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
              window.location.href = `${backendUrl}/accounts/google/login/?process=login`;
            }
          }
        });
        client.requestAccessToken({ prompt: 'select_account' });
        return;
      } catch (err) {
        console.error("Failed to launch Google auth client, redirecting:", err);
      }
    }

    // Fallback to direct OAuth redirect
    const backendUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    window.location.href = `${backendUrl}/accounts/google/login/?process=login`;
  };

  useEffect(() => {
    // Clear any messages when mounting
    clearMessage();
  }, []);

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    // If OTP flow triggered, redirect to verify-otp page
    if (otpSent) {
      navigate('/accounts/verify-otp');
    }
  }, [otpSent, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await login(username, password);
    setSubmitting(false);
  };

  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-5">
        <div className="card border-0 shadow-lg p-4 p-md-5 rounded-4 animate__animated animate__fade-in">
          <div className="text-center mb-5">
            <img
              src="/static/images/logo_circle.png"
              alt="Logo"
              className="brand-logo mx-auto mb-4"
              style={{ width: '64px', height: '64px' }}
            />
            <h2 className="fw-bold text-dark">Welcome Back</h2>
            <p className="text-muted">Enter your credentials to access your account</p>
          </div>

          {message && (
            <div className="mb-4 animate__animated animate__fade-in">
              <div className={`alert alert-${message.type} alert-dismissible fade show`} role="alert">
                {message.text}
                <button type="button" className="btn-close" onClick={clearMessage}></button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="needs-validation">
            <div className="mb-4">
              <label htmlFor="username" className="form-label">
                Username or Email
              </label>
              <div className="position-relative">
                <input
                  type="text"
                  id="username"
                  className="form-control"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username or email"
                  style={{ padding: '0.75rem 1rem' }}
                />
              </div>
            </div>

            <div className="mb-4 position-relative">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <label htmlFor="password" className="form-label mb-0 fw-semibold">Password</label>
                <Link to="/accounts/forgot-password" className="text-decoration-none text-primary small">
                  Forgot password?
                </Link>
              </div>
              <div className="position-relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className="form-control"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  style={{ padding: '0.75rem 1rem 0.75rem 1rem' }}
                />
                <button
                  type="button"
                  className="btn-toggle-password position-absolute"
                  onClick={togglePassword}
                  style={{
                    right: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    zIndex: 10,
                    padding: 0
                  }}
                >
                  <i className={`bi ${showPassword ? 'bi-eye' : 'bi-eye-slash'} text-muted`}></i>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary w-100 py-3 mt-3 fw-bold rounded-3"
            >
              {submitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="text-center my-4 position-relative">
            <hr className="text-muted opacity-25" />
            <span
              className="position-absolute top-50 start-50 translate-middle bg-white px-3 text-muted small"
              style={{ userSelect: 'none' }}
            >
              OR CONTINUE WITH
            </span>
          </div>

          <div className="d-grid mb-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="btn btn-social w-100 text-center py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2"
            >
              <i className="bi bi-google text-danger fs-5"></i>
              <span>Continue with Google</span>
            </button>
          </div>

          <div className="mt-5 text-center">
            <p className="text-muted mb-0">
              Don't have an account?{' '}
              <Link to="/accounts/signup" className="text-primary text-decoration-none fw-semibold">
                Sign up for free
              </Link>
            </p>
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .btn-social {
            border: 1px solid #e2e8f0;
            padding: 0.75rem;
            border-radius: 10px;
            color: #64748b;
            transition: all 0.2s;
            display: inline-block;
        }
        .btn-social:hover {
            background: #f8fafc;
            border-color: #cbd5e1;
            color: #1e293b;
        }
        .form-control {
            padding: 0.75rem 1rem !important;
        }
      `}} />
      </div>
    </div>
  );
}
