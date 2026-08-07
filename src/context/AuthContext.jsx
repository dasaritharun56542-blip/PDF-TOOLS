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
if (API_BASE_URL) {
  axios.defaults.baseURL = API_BASE_URL;
}
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';
axios.defaults.withCredentials = true;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [otpSent, setOtpSent] = useState(false);
  const [isSignupFlow, setIsSignupFlow] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [googleClientId, setGoogleClientId] = useState(import.meta.env.VITE_GOOGLE_CLIENT_ID || '635971381104-v3q2u69tim8oihrjrrcispfsvhjsjim4.apps.googleusercontent.com');
  const [googleScriptLoaded, setGoogleScriptLoaded] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'danger' | 'warning', text: '...' }

  const checkAuthStatus = async () => {
    try {
      const res = await axios.get('/api/auth-status/');
      if (res.data && res.data.google_client_id) {
        setGoogleClientId(res.data.google_client_id);
      }
      if (res.data && res.data.authenticated) {
        setUser(res.data.user);
      } else {
        setUser(null);
      }
      return res.data;
    } catch (err) {
      console.warn("Auth check warning:", err.message || err);
      setUser(null);
      return { authenticated: false };
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
      if (res.data.success) {
        setUser(res.data.user);
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
      setUser(null);
      setMessage({ type: 'success', text: 'Logged out successfully.' });
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const loginWithGoogle = async (accessToken) => {
    clearMessage();
    try {
      const token = typeof accessToken === 'string'
        ? accessToken
        : (accessToken?.access_token || accessToken?.credential || accessToken?.id_token || accessToken?.token);

      if (!token) {
        window.location.href = '/accounts/google/login/?process=login';
        return { success: false, error: 'Redirecting to Google...' };
      }

      const res = await axios.post('/accounts/google-login/', { access_token: token, credential: token, id_token: token });
      if (res.data && res.data.success) {
        setUser(res.data.user);
        return { success: true };
      }
      
      // Fallback to direct OAuth redirect if API returns error
      console.warn("Google popup API returned error, redirecting to OAuth fallback:", res.data?.error);
      window.location.href = '/accounts/google/login/?process=login';
      return { success: false, error: 'Redirecting to Google...' };
    } catch (err) {
      // Fallback to direct OAuth redirect if network or server error occurs
      console.warn("Google login API error, redirecting to OAuth fallback:", err);
      window.location.href = '/accounts/google/login/?process=login';
      return { success: false, error: 'Redirecting to Google...' };
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
