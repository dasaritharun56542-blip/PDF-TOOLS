import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Signup() {
  const { user, loading, signup, otpSent, message, clearMessage, googleClientId, googleScriptLoaded, loginWithGoogle, checkAuthStatus } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleLogin = async (e) => {
    e.preventDefault();
    clearMessage();
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
          scope: 'profile email',
          callback: async (response) => {
            const token = response.access_token || response.credential || response.id_token;
            if (token) {
              setSubmitting(true);
              const res = await loginWithGoogle(token);
              setSubmitting(false);
              if (res.success) {
                navigate('/dashboard');
              }
            } else if (response.error && response.error !== 'popup_closed_by_user') {
              setSubmitting(false);
              const backendUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
              window.location.href = `${backendUrl}/accounts/google/login/?process=signup`;
            }
          },
          error_callback: (err) => {
            setSubmitting(false);
            const backendUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
            window.location.href = `${backendUrl}/accounts/google/login/?process=signup`;
          }
        });
        client.requestAccessToken();
        return;
      } catch (err) {
        console.error("Failed to launch Google auth client, redirecting:", err);
      }
    }

    // Fallback to direct OAuth redirect
    const backendUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    window.location.href = `${backendUrl}/accounts/google/login/?process=signup`;
  };

  useEffect(() => {
    clearMessage();
  }, []);

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (otpSent) {
      navigate('/accounts/verify-otp');
    }
  }, [otpSent, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await signup(username, email, password1, password2);
    setSubmitting(false);
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
            <h2 className="fw-bold text-dark">Create Account</h2>
            <p className="text-muted">Start processing your PDFs with ease</p>
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
                Username
              </label>
              <input
                type="text"
                id="username"
                className="form-control"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="email" className="form-label">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                className="form-control"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
              />
            </div>

            <div className="mb-4">
              <label htmlFor="password1" className="form-label">
                Password
              </label>
              <div className="position-relative">
                <input
                  type={showPassword1 ? 'text' : 'password'}
                  id="password1"
                  className="form-control"
                  required
                  value={password1}
                  onChange={(e) => setPassword1(e.target.value)}
                  placeholder="Enter a secure password"
                />
                <button
                  type="button"
                  className="btn-toggle-password position-absolute"
                  onClick={() => setShowPassword1(!showPassword1)}
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
                  <i className={`bi ${showPassword1 ? 'bi-eye' : 'bi-eye-slash'} text-muted`}></i>
                </button>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="password2" className="form-label">
                Confirm Password
              </label>
              <div className="position-relative">
                <input
                  type={showPassword2 ? 'text' : 'password'}
                  id="password2"
                  className="form-control"
                  required
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Repeat your password"
                />
                <button
                  type="button"
                  className="btn-toggle-password position-absolute"
                  onClick={() => setShowPassword2(!showPassword2)}
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
                  <i className={`bi ${showPassword2 ? 'bi-eye' : 'bi-eye-slash'} text-muted`}></i>
                </button>
              </div>
            </div>

            <div className="form-check text-start mb-3 mt-3">
              <input
                className="form-check-input mt-0.5 me-2"
                type="checkbox"
                id="signupTermsCheck"
                required
                defaultChecked
              />
              <label className="form-check-label small text-muted" htmlFor="signupTermsCheck">
                I agree to the <Link to="/terms" target="_blank" className="text-primary fw-semibold">Terms & Conditions</Link> and <Link to="/refund-policy" target="_blank" className="text-primary fw-semibold">Refund Policy</Link>.
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary w-100 py-3 mt-1 fw-bold rounded-3"
            >
              {submitting ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>

          <div className="text-center my-4 position-relative">
            <hr className="text-muted opacity-25" />
            <span className="position-absolute top-50 start-50 translate-middle bg-white px-3 text-muted small">
              OR REGISTER WITH
            </span>
          </div>

          <div className="d-grid mb-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="btn btn-social w-100 text-center py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2"
            >
              <i className="bi bi-google text-danger fs-5"></i>
              <span>Register with Google</span>
            </button>
          </div>

          <div className="mt-5 text-center">
            <p className="text-muted mb-0">
              Already registered?{' '}
              <Link to="/accounts/login" className="text-primary text-decoration-none fw-semibold">
                Sign in here
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
