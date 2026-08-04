import React from 'react';
import { Link } from 'react-router-dom';

export default function PaymentCancel() {
  return (
    <div className="container py-5 text-center">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card border-0 shadow-lg p-5 rounded-4 animate__animated animate__zoom-in">
            <div className="bg-warning-subtle d-inline-block p-4 rounded-circle mb-4" style={{ width: 'fit-content', margin: '0 auto' }}>
              <i className="bi bi-exclamation-circle-fill display-2 text-warning"></i>
            </div>
            <h1 className="display-5 fw-bold text-dark mb-3">Payment Cancelled</h1>
            <p className="text-muted mb-5 lead">
              The checkout process was cancelled. No charges were made, and your account status remains unchanged.
            </p>
            <div className="d-grid gap-3 d-sm-flex justify-content-center">
              <Link to="/accounts/pricing" className="btn btn-primary btn-lg rounded-pill px-5 fw-bold shadow-sm">
                Try Again
              </Link>
              <Link to="/dashboard" className="btn btn-light btn-lg rounded-pill px-5 border">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
