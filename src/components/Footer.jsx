import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="py-5 mt-5 bg-white border-top border-light">
      <div className="container">
        <div className="row align-items-center">
          <div className="col-md-4 text-center text-md-start mb-4 mb-md-0">
            <Link className="navbar-brand d-flex align-items-center mb-3 justify-content-center justify-content-md-start text-decoration-none" to="/">
              <img
                src="/static/images/logo_circle.png"
                alt="PDF Powerhouse"
                className="brand-logo me-2"
                style={{ width: '24px', height: '24px' }}
              />
              <span className="fw-bold text-dark">
                PDF <span style={{ fontWeight: 400, color: '#64748b' }}>Powerhouse</span>
              </span>
            </Link>
            <p className="text-muted small mb-0">
              The world's most professional and secure PDF toolkit. Process your documents with confidence.
            </p>
          </div>

          <div className="col-md-4 text-center mb-4 mb-md-0">
            <div className="social-links">
              <a href="#" className="text-muted mx-2 fs-5"><i className="bi bi-github"></i></a>
              <a href="#" className="text-muted mx-2 fs-5"><i className="bi bi-discord"></i></a>
              <a href="#" className="text-muted mx-2 fs-5"><i className="bi bi-twitter-x"></i></a>
              <a href="#" className="text-muted mx-2 fs-5"><i className="bi bi-linkedin"></i></a>
            </div>
          </div>

          <div className="col-md-4 text-center text-md-end">
            <p className="text-dark fw-bold mb-1">© 2026 PDF Powerhouse</p>
            <p className="text-muted small">
              Developed by <span className="text-primary fw-semibold">Dasari Tharun Tej</span>
            </p>
          </div>
        </div>

        <hr className="my-4 text-muted opacity-25" />

        <div className="d-flex flex-wrap justify-content-center gap-4 small text-muted">
          <div className="d-flex align-items-center">
            <i className="bi bi-shield-check text-success me-2"></i>
            <span>SSL Secured</span>
          </div>
          <div className="d-flex align-items-center">
            <i className="bi bi-clock-history text-primary me-2"></i>
            <span>Auto-Delete (24h)</span>
          </div>
          <div className="d-flex align-items-center">
            <i className="bi bi-lock text-warning me-2"></i>
            <span>End-to-End Encrypted</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
