import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('order_id');
  const sessionId = searchParams.get('session_id');
  const { checkAuthStatus } = useAuth();

  const [paymentDetails, setPaymentDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        if (orderId) {
          const res = await axios.get(`/accounts/payment-status/${orderId}/`);
          if (res.data && res.data.success) {
            setPaymentDetails(res.data);
          }
          await checkAuthStatus();
        } else if (sessionId) {
          const res = await axios.get(`/api/payment-success-verify/?session_id=${sessionId}`);
          if (res.data && res.data.success) {
            setPaymentDetails(res.data);
          }
          await checkAuthStatus();
        } else {
          await checkAuthStatus();
        }
      } catch (err) {
        console.error('Error verifying payment status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [orderId, sessionId]);

  return (
    <div className="container py-5 text-center">
      <div className="row justify-content-center">
        <div className="col-md-7 col-lg-6">
          <div className="card shadow-lg border-0 rounded-4 p-4 p-md-5 animate__animated animate__zoomIn">
            <div className="mb-4">
              <div className="bg-success-subtle text-success rounded-circle d-inline-flex p-3 mb-3">
                <i className="bi bi-check-circle-fill display-4"></i>
              </div>
              <h1 className="fw-bold text-dark mb-2">Payment Successful! 🎉</h1>
              <p className="text-muted lead">
                Your account has been upgraded to <strong>PRO</strong> automatically.
              </p>
            </div>

            {paymentDetails && (
              <div className="bg-light p-4 rounded-4 text-start mb-4 border border-light">
                <h6 className="fw-bold text-uppercase text-muted small mb-3 border-bottom pb-2">
                  Transaction Summary
                </h6>
                <div className="row g-2 small">
                  <div className="col-6 text-muted">Plan Purchased:</div>
                  <div className="col-6 text-end fw-bold text-dark">{paymentDetails.plan_name}</div>

                  <div className="col-6 text-muted">Amount Paid:</div>
                  <div className="col-6 text-end fw-bold text-success">₹{paymentDetails.amount}</div>

                  <div className="col-6 text-muted">Order ID:</div>
                  <div className="col-6 text-end text-truncate font-monospace">{paymentDetails.order_id || orderId}</div>

                  {paymentDetails.transaction_id && (
                    <>
                      <div className="col-6 text-muted">Transaction ID:</div>
                      <div className="col-6 text-end text-truncate font-monospace">{paymentDetails.transaction_id}</div>
                    </>
                  )}

                  {paymentDetails.expiry_date && (
                    <>
                      <div className="col-6 text-muted">PRO Valid Until:</div>
                      <div className="col-6 text-end fw-bold text-primary">{paymentDetails.expiry_date}</div>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="d-grid gap-3">
              {paymentDetails && paymentDetails.invoice_id && (
                <a
                  href={`/accounts/download-invoice/${paymentDetails.invoice_id}/`}
                  className="btn btn-outline-primary btn-lg rounded-pill fw-bold shadow-sm"
                  download
                >
                  <i className="bi bi-file-earmark-pdf me-2"></i> Download Official Tax Invoice (PDF)
                </a>
              )}

              <Link to="/dashboard" className="btn btn-primary btn-lg rounded-pill fw-bold shadow-sm">
                <i className="bi bi-speedometer2 me-2"></i> Go to Dashboard
              </Link>

              <Link to="/" className="btn btn-link text-decoration-none text-muted small">
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
