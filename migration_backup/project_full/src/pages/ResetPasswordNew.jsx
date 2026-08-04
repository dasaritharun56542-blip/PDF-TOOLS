import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

export default function ResetPasswordNew() {
  const location = useLocation();
  const navigate = useNavigate();
  const resetToken = location.state?.reset_token || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const validatePasswordRules = (pass) => {
    if (pass.length < 8) return 'Password must be at least 8 characters long.';
    if (!/[A-Z]/.test(pass)) return 'Password must contain at least 1 uppercase letter.';
    if (!/[a-z]/.test(pass)) return 'Password must contain at least 1 lowercase letter.';
    if (!/[0-9]/.test(pass)) return 'Password must contain at least 1 number.';
    if (!/[^A-Za-z0-9]/.test(pass)) return 'Password must contain at least 1 special character.';
    return null;
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!resetToken) {
      setError('Invalid or expired reset session. Please request a new OTP.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const policyError = validatePasswordRules(password);
    if (policyError) {
      setError(policyError);
      return;
    }

    setLoading(true);

    try {
      const res = await axios.post('/accounts/api/password-reset/confirm/', {
        reset_token: resetToken,
        password: password
      });

      if (res.data && res.data.success) {
        setMessage('Password updated successfully! Redirecting to login...');
        setTimeout(() => {
          navigate('/accounts/login');
        }, 2000);
      } else {
        setError(res.data.error || 'Failed to update password.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Password update failed. Please try again.');
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
                <div className="bg-success-subtle text-success rounded-circle d-inline-flex p-3 mb-3">
                  <i className="bi bi-check-circle-fill fs-2"></i>
                </div>
                <h3 className="fw-bold">Create New Password</h3>
                <p className="text-muted small">Choose a strong, secure new password for your account.</p>
              </div>

              {error && <div className="alert alert-danger rounded-3 small py-2">{error}</div>}
              {message && <div className="alert alert-success rounded-3 small py-2">{message}</div>}

              <form onSubmit={handleResetPassword}>
                <div className="mb-3">
                  <label className="form-label fw-semibold">New Password</label>
                  <input
                    type="password"
                    className="form-control form-control-lg"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <div className="form-text fs-7 text-muted">
                    Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character.
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label fw-semibold">Confirm New Password</label>
                  <input
                    type="password"
                    className="form-control form-control-lg"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-success btn-lg w-100 fw-bold rounded-3 shadow-sm mb-3" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Updating Password...
                    </>
                  ) : (
                    'Set New Password'
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
