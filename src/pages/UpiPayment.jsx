import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function UpiPayment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { checkAuthStatus } = useAuth();

  const paramOrderId = searchParams.get('order_id');
  const paramPlanId = searchParams.get('plan_id');

  const [orderId, setOrderId] = useState(paramOrderId || '');
  const [plan, setPlan] = useState(null);
  const [upiId, setUpiId] = useState('9110396906@ybl');
  const [upiLink, setUpiLink] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('Listening for PhonePe server confirmation...');
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  // 1-Click Manual Payment Request State
  const [submittingReq, setSubmittingReq] = useState(false);
  const [reqSuccess, setReqSuccess] = useState(false);
  const [reqMessage, setReqMessage] = useState('');
  const [reqError, setReqError] = useState('');
  const [referenceNum, setReferenceNum] = useState('');

  // 1. Initialize Dynamic PhonePe Payment Request
  const initPayment = async () => {
    setLoading(true);
    setError('');

    try {
      if (paramOrderId) {
        // Fetch existing backend-locked order details
        const res = await axios.get(`/api/plan-details/?order_id=${paramOrderId}`);
        setOrderId(res.data.order_id);
        setPlan(res.data.plan);
        setUpiId(res.data.upi_id || '9110396906@ybl');
        setUpiLink(res.data.upi_link);
        setQrUrl(res.data.qr_url);

        if (res.data.status === 'success') {
          setVerifiedSuccess(true);
          await checkAuthStatus();
          setTimeout(() => {
            navigate(`/accounts/payment-success?order_id=${paramOrderId}`);
          }, 1500);
        }
      } else if (paramPlanId) {
        // Create new dynamic PhonePe payment order on backend
        const res = await axios.post('/accounts/phonepe/pay/', { plan_id: paramPlanId });
        if (res.data.success) {
          setOrderId(res.data.order_id);
          setPlan({ name: res.data.plan_name, price: res.data.amount });
          setUpiLink(res.data.upi_link);
          setQrUrl(res.data.qr_url);
        } else {
          setError(res.data.error || 'Failed to initiate PhonePe payment session.');
        }
      } else {
        setError('No valid subscription plan selected.');
      }
    } catch (err) {
      console.error('Payment initiation error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to connect to PhonePe gateway.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initPayment();
  }, [paramOrderId, paramPlanId]);

  // 2. Real-time Automatic PhonePe Verification Polling
  useEffect(() => {
    if (!orderId || verifiedSuccess) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await axios.get(`/accounts/payment-status/${orderId}/`);
        if (res.data && res.data.success) {
          if (res.data.status === 'success') {
            clearInterval(pollInterval);
            setVerifiedSuccess(true);
            setStatusText('Payment Verified! Activating your PRO account...');
            await checkAuthStatus();
            setTimeout(() => {
              navigate(`/accounts/payment-success?order_id=${orderId}`);
            }, 1200);
          } else if (res.data.status === 'failed') {
            clearInterval(pollInterval);
            setError('Payment was declined or failed. Please try again.');
          }
        }
      } catch (err) {
        // Silent catch for background polling
      }
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [orderId, verifiedSuccess, navigate, checkAuthStatus]);

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-3 text-muted fw-semibold">Generating Dynamic PhonePe Payment Request...</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="container py-5 text-center">
        <div className="row justify-content-center">
          <div className="col-md-6">
            <div className="card shadow border-0 rounded-4 p-4">
              <div className="alert alert-danger rounded-3 mb-4">{error || 'Invalid plan or session expired.'}</div>
              <Link to="/accounts/pricing" className="btn btn-primary rounded-pill px-4 fw-bold">
                <i className="bi bi-arrow-left me-2"></i> Back to Subscription Plans
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleCompletedPaymentClick = async () => {
    setReqError('');
    setSubmittingReq(true);

    try {
      const res = await axios.post('/accounts/submit-payment-request/', {
        order_id: orderId
      });

      if (res.data.success) {
        setReqSuccess(true);
        setReqMessage(res.data.message || 'Payment Approval Request created successfully. Waiting for Admin approval.');
        setReferenceNum(res.data.reference_number || '');
        setStatusText('Your payment approval request is waiting for Admin review.');
      } else {
        setReqError(res.data.error || 'Failed to submit payment request.');
      }
    } catch (err) {
      setReqError(err.response?.data?.error || 'Failed to submit payment request. Please try again.');
    } finally {
      setSubmittingReq(false);
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-7 text-center">
          <div className="card shadow-lg border-0 rounded-4 p-4" data-aos="zoom-in">
            {/* Header */}
            <div className="mb-4">
              <span className="badge bg-primary-subtle text-primary rounded-pill px-3 py-2 mb-2 fw-bold">
                DYNAMIC PHONEPE & MANUAL APPROVAL GATEWAY
              </span>
              <h2 className="fw-bold text-dark">{plan?.name || 'Pro Subscription'}</h2>
              <div className="d-inline-flex align-items-center gap-2 bg-success-subtle text-success px-3 py-1.5 rounded-pill mt-1">
                <i className="bi bi-lock-fill"></i>
                <span className="fw-bold">LOCKED AMOUNT: ₹{plan?.price ?? '0.00'}</span>
              </div>
            </div>

            {/* Dual QR Options: Locked Amount QR & Static PhonePe Poster QR */}
            <div className="bg-light p-4 rounded-4 mb-4 border border-light shadow-sm">
              {verifiedSuccess ? (
                <div className="py-4 text-success text-center">
                  <div className="spinner-grow text-success mb-3" role="status" style={{ width: '3rem', height: '3rem' }}></div>
                  <h4 className="fw-bold">Payment Verified & Approved!</h4>
                  <p className="text-muted small">Redirecting to your PRO Dashboard...</p>
                </div>
              ) : (
                <>
                  <div className="row g-3 justify-content-center align-items-center mb-3">
                    {/* Option 1: Fixed & Locked Amount QR */}
                    <div className="col-md-6 text-center">
                      <div className="border bg-white p-3 rounded-4 shadow-sm h-100">
                        <span className="badge bg-success-subtle text-success rounded-pill px-2.5 py-1 small fw-bold mb-2">
                          LOCKED AMOUNT QR (₹{plan?.price ?? '0.00'})
                        </span>
                        {qrUrl ? (
                          <img
                            src={qrUrl}
                            alt={`Fixed Amount UPI QR Code - ₹${plan?.price}`}
                            className="img-fluid rounded border p-2 bg-white"
                            style={{ maxWidth: '190px', height: '190px' }}
                          />
                        ) : (
                          <div className="d-flex align-items-center justify-content-center bg-light rounded p-4" style={{ width: '190px', height: '190px' }}>
                            <div className="spinner-border text-primary" role="status"></div>
                          </div>
                        )}
                        <div className="small text-muted mt-1 font-monospace fs-7">Auto-locks ₹{plan?.price} Amount</div>
                      </div>
                    </div>

                    {/* Option 2: Official Static PhonePe Poster QR */}
                    <div className="col-md-6 text-center">
                      <div className="border bg-dark p-3 rounded-4 shadow-sm h-100 text-white">
                        <span className="badge bg-primary rounded-pill px-2.5 py-1 small fw-bold mb-2">
                          STATIC PHONEPE QR
                        </span>
                        <img
                          src="/phonepe_qr.jpg"
                          onError={(e) => { e.target.src = "/static/images/phonepe_qr.jpg"; }}
                          alt="PhonePe QR Code - Dasari Tharun Teja"
                          className="img-fluid rounded-3 border border-secondary p-1"
                          style={{ maxWidth: '190px', height: '190px', objectFit: 'contain' }}
                        />
                        <div className="small text-white-50 mt-1 fs-7">Dasari Tharun Teja</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-center">
                    <p className="small text-muted mb-2">
                      Order Reference: <strong className="text-dark font-monospace">{orderId}</strong>
                    </p>
                    <a
                      href={upiLink}
                      className="btn btn-primary btn-lg rounded-pill px-4 shadow-sm w-100 fw-bold mb-2"
                    >
                      <i className="bi bi-phone me-2"></i> Pay Locked ₹{plan?.price ?? '0.00'} via PhonePe / UPI App
                    </a>
                  </div>
                </>
              )}
            </div>

            {/* 1-Click Payment Completion Request Box */}
            <div className="bg-white p-4 rounded-4 mb-4 border text-start shadow-sm">
              <h6 className="fw-bold text-dark mb-2 d-flex align-items-center">
                <i className="bi bi-patch-check me-2 text-success fs-5"></i>
                Payment Approval Confirmation
              </h6>
              <p className="small text-muted mb-3">
                After completing payment in your UPI app, click below to notify Admin. Admin will verify your payment and activate your PRO subscription.
              </p>

              {reqSuccess ? (
                <div className="alert alert-warning border-0 shadow-sm rounded-3 p-3 mb-0">
                  <div className="d-flex align-items-center mb-2">
                    <div className="spinner-border spinner-border-sm text-warning me-2" role="status"></div>
                    <span className="fw-bold fs-6 text-warning-emphasis">Waiting for Admin Approval</span>
                  </div>
                  <p className="small mb-1 text-dark">{reqMessage}</p>
                  {referenceNum && (
                    <div className="small font-monospace bg-white p-2 rounded border mt-2">
                      Request ID: <strong className="text-dark">{referenceNum}</strong>
                    </div>
                  )}
                  <p className="small text-muted mb-0 mt-2">
                    Admin is reviewing your payment request. Your PRO features and Tax Invoice will be generated automatically upon approval.
                  </p>
                </div>
              ) : (
                <div>
                  {reqError && <div className="alert alert-danger rounded-3 p-2 small mb-3">{reqError}</div>}

                  <button
                    type="button"
                    onClick={handleCompletedPaymentClick}
                    disabled={submittingReq}
                    className="btn btn-success btn-lg w-100 rounded-pill fw-bold py-3 shadow"
                  >
                    {submittingReq ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span> Creating Request...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle-fill me-2 fs-5"></i> I Have Completed Payment
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Real-time Verification Status Box */}
            <div className="alert alert-info border-0 rounded-4 shadow-sm p-3 mb-4 text-start">
              <div className="d-flex align-items-center">
                <div className="spinner-border spinner-border-sm text-info me-3 flex-shrink-0" role="status"></div>
                <div>
                  <div className="fw-bold text-info-emphasis mb-0">Server Verification Active</div>
                  <div className="small text-muted">{statusText}</div>
                </div>
              </div>
            </div>

            <div className="text-start mb-3 bg-light border p-3 rounded-3">
              <h6 className="fw-bold small text-uppercase text-muted mb-2">Payment Security:</h6>
              <ul className="small text-muted mb-0 ps-3">
                <li className="mb-1">Amount is locked to <strong>₹{plan.price}</strong> on the backend.</li>
                <li className="mb-1">Order reference is unique to this transaction (<strong>{orderId}</strong>).</li>
                <li>Submit your UTR or wait for automatic callback — PRO subscription activates upon approval!</li>
              </ul>
            </div>

            <div className="mt-3">
              <Link to="/accounts/pricing" className="btn btn-link text-decoration-none text-muted small">
                <i className="bi bi-arrow-left me-1"></i> Cancel and return to Pricing
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
