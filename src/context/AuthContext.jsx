import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

// Get CSRF cookie value for Django
export function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

// Setup Axios defaults to pass CSRF and session cookies across domains
let API_BASE_URL = import.meta.env.VITE_API_URL || '';
if (API_BASE_URL && API_BASE_URL.endsWith('/')) {
  API_BASE_URL = API_BASE_URL.slice(0, -1);
}
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';
axios.defaults.withCredentials = true;

// Check for session_key from URL query params or localStorage
try {
  const urlParams = new URLSearchParams(window.location.search);
  const qSession = urlParams.get('session_key');
  if (qSession) {
    localStorage.setItem('pdf_powerhouse_session_key', qSession);
    urlParams.delete('session_key');
    const newQuery = urlParams.toString();
    const cleanUrl = window.location.pathname + (newQuery ? '?' + newQuery : '') + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
  }
} catch (e) {}

const storedSessionKey = localStorage.getItem('pdf_powerhouse_session_key');
if (storedSessionKey) {
  axios.defaults.headers.common['X-Session-Key'] = storedSessionKey;
  axios.defaults.headers.common['Authorization'] = 'Bearer ' + storedSessionKey;
}

try {
  const savedUserStr = localStorage.getItem('pdf_powerhouse_user');
  if (savedUserStr) {
    const savedUserObj = JSON.parse(savedUserStr);
    if (savedUserObj?.email) axios.defaults.headers.common['X-User-Email'] = savedUserObj.email;
    if (savedUserObj?.username) axios.defaults.headers.common['X-User-Name'] = savedUserObj.username;
  }
} catch (e) {}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('pdf_powerhouse_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(!localStorage.getItem('pdf_powerhouse_user'));
  const [otpSent, setOtpSent] = useState(false);
  const [isSignupFlow, setIsSignupFlow] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [googleClientId, setGoogleClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || '635971381104-v3q2u69tim8oihrjrrcispfsvhjsjim4.apps.googleusercontent.com');
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'danger' | 'warning', text: '...' }

  const checkAuthStatus = async () => {
    try {
      const sKey = localStorage.getItem('pdf_powerhouse_session_key');
      if (sKey) {
        axios.defaults.headers.common['X-Session-Key'] = sKey;
        axios.defaults.headers.common['Authorization'] = 'Bearer ' + sKey;
      }
      const res = await axios.get('/api/auth-status/');
      if (res.data && res.data.google_client_id) {
        setGoogleClientId(res.data.google_client_id);
      }
      if (res.data && res.data.authenticated && res.data.user) {
        setUser(res.data.user);
        localStorage.setItem('pdf_powerhouse_user', JSON.stringify(res.data.user));
        if (res.data.user.email) axios.defaults.headers.common['X-User-Email'] = res.data.user.email;
        if (res.data.user.username) axios.defaults.headers.common['X-User-Name'] = res.data.user.username;
        if (res.data.session_key) {
          localStorage.setItem('pdf_powerhouse_session_key', res.data.session_key);
          axios.defaults.headers.common['X-Session-Key'] = res.data.session_key;
          axios.defaults.headers.common['Authorization'] = 'Bearer ' + res.data.session_key;
        }
      } else if (res.data && res.data.authenticated === false && !sKey) {
        setUser(null);
        localStorage.removeItem('pdf_powerhouse_user');
        delete axios.defaults.headers.common['X-User-Email'];
        delete axios.defaults.headers.common['X-User-Name'];
      }
      return res.data;
    } catch (err) {
      console.warn("Auth check warning:", err.message || err);
      return { authenticated: !!user };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();

    if (window.google) {
      setGoogleScriptLoaded(true);
      return;
    }

    const loadGoogleScript = () => {
      const scriptId = 'google-gsi-client';
      const existingScript = document.getElementById(scriptId);
      if (existingScript) {
        existingScript.addEventListener('load', () => setGoogleScriptLoaded(true));
        existingScript.addEventListener('error', () => console.error("Google script load error"));
        return;
      }

      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setGoogleScriptLoaded(true);
        console.log("Google Identity Services SDK loaded successfully.");
      };
      script.onerror = () => {
        console.error("Failed to load Google Identity Services SDK.");
      };
      document.body.appendChild(script);
    };

    loadGoogleScript();
  }, []);

  const clearMessage = () => setMessage(null);

  const login = async (username, password) => {
    clearMessage();
    try {
      const res = await axios.post('/accounts/login/', { username, password });
      if (res.data.otp_required) {
        setOtpSent(true);
        setIsSignupFlow(res.data.is_signup_flow);
        setOtpEmail(res.data.email);
        if (res.data.message) {
          setMessage({
            type: res.data.delivery_success ? 'success' : 'warning',
            text: res.data.message
          });
        }
        return { otpRequired: true };
      }
      return { success: false };
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Invalid username or password.';
      setMessage({ type: 'danger', text: errMsg });
      return { success: false, error: errMsg };
    }
  };

  const signup = async (username, email, password1, password2) => {
    clearMessage();
    try {
      const res = await axios.post('/accounts/signup/', {
        username,
        email,
        password1,
        password2
      });
      if (res.data.otp_required) {
        setOtpSent(true);
        setIsSignupFlow(true);
        setOtpEmail(res.data.email);
        if (res.data.message) {
          setMessage({
            type: res.data.delivery_success ? 'success' : 'warning',
            text: res.data.message
          });
        }
        return { otpRequired: true };
      }
      return { success: false };
    } catch (err) {
      const errMsg = err.response?.data?.error || 'An error occurred during signup.';
      setMessage({ type: 'danger', text: errMsg });
      return { success: false, error: errMsg };
    }
  };

  const verifyOtp = async (otp) => {
    clearMessage();
    try {
      const res = await axios.post('/accounts/verify-otp/', { otp });
      if (res.data.success && res.data.user) {
        if (res.data.session_key) {
          localStorage.setItem('pdf_powerhouse_session_key', res.data.session_key);
          axios.defaults.headers.common['X-Session-Key'] = res.data.session_key;
          axios.defaults.headers.common['Authorization'] = 'Bearer ' + res.data.session_key;
        }
        setUser(res.data.user);
        localStorage.setItem('pdf_powerhouse_user', JSON.stringify(res.data.user));
        setOtpSent(false);
        setMessage({ type: 'success', text: 'Authentication successful.' });
        return { success: true };
      }
      return { success: false };
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Invalid or expired OTP.';
      setMessage({ type: 'danger', text: errMsg });
      return { success: false, error: errMsg };
    }
  };

  const resendOtp = async () => {
    clearMessage();
    try {
      const res = await axios.post('/accounts/resend-otp/');
      if (res.data.success) {
        setMessage({ type: 'success', text: res.data.message });
        return { success: true };
      }
      return { success: false };
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to resend OTP.';
      setMessage({ type: 'danger', text: errMsg });
      return { success: false, error: errMsg };
    }
  };

  const logout = async () => {
    clearMessage();
    try {
      await axios.post('/accounts/logout/');
    } catch (err) {
      console.error('Logout failed', err);
    } finally {
      setUser(null);
      localStorage.removeItem('pdf_powerhouse_user');
      localStorage.removeItem('pdf_powerhouse_session_key');
      delete axios.defaults.headers.common['X-Session-Key'];
      delete axios.defaults.headers.common['Authorization'];
      setMessage({ type: 'success', text: 'Logged out successfully.' });
    }
  };

  const loginWithGoogle = async (accessToken) => {
    clearMessage();
    try {
      const token = typeof accessToken === 'string'
        ? accessToken
        : (accessToken?.access_token || accessToken?.credential || accessToken?.id_token || accessToken?.token);

      if (!token) {
        const errMsg = 'No valid authentication token received from Google profile.';
        setMessage({ type: 'danger', text: errMsg });
        return { success: false, error: errMsg };
      }

      const res = await axios.post('/accounts/google-login/', { access_token: token, credential: token, id_token: token });
      if (res.data && res.data.success && res.data.user) {
        if (res.data.session_key) {
          localStorage.setItem('pdf_powerhouse_session_key', res.data.session_key);
          axios.defaults.headers.common['X-Session-Key'] = res.data.session_key;
          axios.defaults.headers.common['Authorization'] = 'Bearer ' + res.data.session_key;
        }
        localStorage.setItem('pdf_powerhouse_user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        return { success: true };
      }
      
      const errMsg = res.data?.error || 'Google login could not complete. Please try again.';
      setMessage({ type: 'danger', text: errMsg });
      return { success: false, error: errMsg };
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Server error during Google authentication. Please try again.';
      setMessage({ type: 'danger', text: errMsg });
      return { success: false, error: errMsg };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      setUser,
      loading,
      otpSent,
      isSignupFlow,
      otpEmail,
      message,
      setMessage,
      clearMessage,
      login,
      signup,
      verifyOtp,
      resendOtp,
      logout,
      checkAuthStatus,
      googleClientId,
      googleScriptLoaded,
      loginWithGoogle
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
