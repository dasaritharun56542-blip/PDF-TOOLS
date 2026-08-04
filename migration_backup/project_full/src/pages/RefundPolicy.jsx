import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function RefundPolicy() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [legalConfig, setLegalConfig] = useState(null);
  const [userPayments, setUserPayments] = useState([]);
  const [myRefundRequests, setMyRefundRequests] = useState([]);
  
  // Refund Modal State
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requestStatusMsg, setRequestStatusMsg] = useState('');
  const [requestSuccess, setRequestSuccess] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const configRes = await axios.get('/accounts/api/legal/config/');
        if (configRes.data && configRes.data.success) {
          setLegalConfig(configRes.data);
        }
      } catch (err) {
        console.error('Legal config error:', err);
      }

      if (user) {
        try {
          // Fetch user dashboard data to extract user payments for easy order selection
          const dashRes = await axios.get('/api/dashboard-data/');
          if (dashRes.data && dashRes.data.payments) {
            setUserPayments(dashRes.data.payments.filter(p => p.status === 'success' || p.status === 'SUCCESS' || p.status === 'completed'));
          }

          // Fetch existing user refund requests
          const refRes = await axios.get('/accounts/api/legal/my-refund-requests/');
          if (refRes.data && refRes.data.refund_requests) {
            setMyRefundRequests(refRes.data.refund_requests);
          }
        } catch (err) {
          console.error('Failed to load user refund data:', err);
        }
      }
    };

    fetchData();
  }, [user]);

  const business = legalConfig?.business || {
    name: 'PDF Powerhouse',
    legal_name: 'PDF Powerhouse Inc.',
    support_email: 'support@pdfpowerhouse.com',
    address: 'Hyderabad, Telangana 500081, India'
  };

  const versioning = legalConfig?.versioning || {
    refund_policy_version: '1.0',
    effective_date: 'August 4, 2026',
    last_updated: 'August 4, 2026'
  };

  const handleOrderChange = (e) => {
    const selectedId = e.target.value;
    setSelectedOrderId(selectedId);
    const match = userPayments.find(p => p.order_id === selectedId);
    if (match && match.invoice_number) {
      setInvoiceNumber(match.invoice_number);
    } else {
      setInvoiceNumber('');
    }
  };

  const handleSubmitRefundRequest = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/accounts/login?next=/refund-policy');
      return;
    }

    if (!selectedOrderId || !refundReason.trim()) {
      setRequestSuccess(false);
      setRequestStatusMsg('Please select a valid Order ID and provide a reason for your refund request.');
      return;
    }

    setSubmitting(true);
    setRequestStatusMsg('');

    try {
      const res = await axios.post('/accounts/api/legal/refund-request/', {
        order_id: selectedOrderId,
        invoice_number: invoiceNumber,
        reason: refundReason
      });

      if (res.data && res.data.success) {
        setRequestSuccess(true);
        setRequestStatusMsg(res.data.message || 'Refund request submitted successfully.');
        setRefundReason('');
        
        // Refresh list of refund requests
        const refRes = await axios.get('/accounts/api/legal/my-refund-requests/');
        if (refRes.data && refRes.data.refund_requests) {
          setMyRefundRequests(refRes.data.refund_requests);
        }

        setTimeout(() => {
          setRefundModalOpen(false);
        }, 2000);
      } else {
        setRequestSuccess(false);
        setRequestStatusMsg(res.data?.error || 'Failed to submit refund request.');
      }
    } catch (err) {
      setRequestSuccess(false);
      setRequestStatusMsg(err.response?.data?.error || 'An error occurred while submitting your refund request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container py-4">
      {/* Header Banner */}
      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 mb-5 bg-dark text-white text-center position-relative overflow-hidden">
        <div className="position-relative z-1">
          <span className="badge bg-primary text-white rounded-pill px-3 py-2 mb-3 fw-bold small text-uppercase">
            Official Policy • Version {versioning.refund_policy_version}
          </span>
          <h1 className="display-5 fw-black mb-2" style={{ fontWeight: 900 }}>
            Refund & Cancellation Policy
          </h1>
          <p className="lead mb-0 text-white-50 mx-auto" style={{ maxWidth: '700px' }}>
            Transparent, fair compliance policy governing subscription purchases, refund eligibility, duplicate charge resolution, and refund request workflows.
          </p>
          <div className="mt-3 small font-monospace text-white-50">
            Effective Date: {versioning.effective_date} | Last Updated: {versioning.last_updated}
          </div>
        </div>
      </div>

      {/* User Quick Action Banner */}
      <div className="row justify-content-center mb-5">
        <div className="col-lg-10">
          <div className="card border-0 shadow-sm rounded-4 p-4 d-flex flex-column flex-md-row align-items-center justify-content-between bg-white border-start border-5 border-primary">
            <div className="d-flex align-items-center mb-3 mb-md-0">
              <div className="bg-primary-subtle p-3 rounded-circle me-3 text-primary">
                <i className="bi bi-arrow-counterclockwise fs-3"></i>
              </div>
              <div>
                <h5 className="fw-bold text-dark mb-1">Need to Request a Refund?</h5>
                <p className="small text-muted mb-0">
                  Select your paid Order ID and submit a formal request for instant compliance review.
                </p>
              </div>
            </div>
            <div>
              {user ? (
                <button
                  onClick={() => setRefundModalOpen(true)}
                  className="btn btn-primary rounded-pill px-4 py-2.5 fw-bold shadow-sm"
                >
                  <i className="bi bi-file-earmark-text me-2"></i> Submit Refund Request
                </button>
              ) : (
                <Link
                  to="/accounts/login?next=/refund-policy"
                  className="btn btn-outline-primary rounded-pill px-4 py-2.5 fw-bold"
                >
                  Log In to Request Refund
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* My Submitted Refund Requests Section */}
      {user && myRefundRequests.length > 0 && (
        <div className="row justify-content-center mb-5">
          <div className="col-lg-10">
            <div className="card border-0 shadow-sm rounded-4 p-4 bg-white">
              <h5 className="fw-bold text-dark mb-3 border-bottom pb-2">
                <i className="bi bi-clock-history text-primary me-2"></i> Your Submitted Refund Requests
              </h5>
              <div className="table-responsive">
                <table className="table table-hover align-middle small mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Request ID</th>
                      <th>Order ID</th>
                      <th>Amount</th>
                      <th>Reason</th>
                      <th>Status</th>
                      <th>Submitted On</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myRefundRequests.map((r) => (
                      <tr key={r.id}>
                        <td className="font-monospace fw-bold">#{r.id}</td>
                        <td className="font-monospace">{r.order_id}</td>
                        <td className="fw-bold text-success">₹{r.amount}</td>
                        <td className="text-truncate" style={{ maxWidth: '180px' }}>{r.reason}</td>
                        <td>
                          <span className={`badge rounded-pill ${
                            r.status === 'REFUNDED' || r.status === 'APPROVED' ? 'bg-success' :
                            (r.status === 'REJECTED' || r.status === 'FAILED' ? 'bg-danger' : 'bg-warning text-dark')
                          }`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="text-muted">{r.created_at}</td>
                        <td className="small text-muted">{r.admin_notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Policy Content Body */}
      <div className="row justify-content-center">
        <div className="col-lg-10">
          <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
            
            {/* Section 1: Purpose & Scope */}
            <section className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                1. Purpose & Scope
              </h3>
              <p className="text-muted leading-relaxed">
                This Refund & Cancellation Policy outlines the conditions under which refunds are evaluated, processed, approved, or rejected for digital Pro Subscription plans on <strong>{business.name}</strong> (operated by <strong>{business.legal_name}</strong>).
              </p>
              <p className="text-muted leading-relaxed">
                As a provider of automated, instant-access digital PDF processing tools, {business.name} strives to maintain a transparent, fair, and legally compliant balance between digital service delivery and consumer protection rights.
              </p>
            </section>

            {/* Section 2: Eligibility Matrix */}
            <section className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                2. Refund Eligibility Criteria
              </h3>
              
              <div className="row g-4 mb-3">
                <div className="col-md-6">
                  <div className="card border-success border-opacity-25 bg-success-subtle bg-opacity-10 h-100 p-3 rounded-4">
                    <h6 className="fw-bold text-success mb-2">
                      <i className="bi bi-check-circle-fill me-2"></i> Eligible Purchases
                    </h6>
                    <ul className="small text-muted mb-0 leading-relaxed ps-3">
                      <li><strong>Duplicate Billing:</strong> The user was accidentally charged twice for the same subscription transaction due to a payment gateway glitch.</li>
                      <li><strong>Unactivated Transaction:</strong> Payment was successfully charged from the user's bank account, but Pro access was NOT activated due to server error or network dropout.</li>
                      <li><strong>Qualifying Technical Failure:</strong> Major service interruption where the platform's core PDF engines failed completely to perform requested operations for more than 48 consecutive hours.</li>
                      <li><strong>Unauthorized Transaction:</strong> Payment was executed fraudulently without account holder authorization (subject to verification).</li>
                    </ul>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="card border-danger border-opacity-25 bg-danger-subtle bg-opacity-10 h-100 p-3 rounded-4">
                    <h6 className="fw-bold text-danger mb-2">
                      <i className="bi bi-x-circle-fill me-2"></i> Non-Eligible Purchases
                    </h6>
                    <ul className="small text-muted mb-0 leading-relaxed ps-3">
                      <li><strong>Digital Consumption:</strong> Requests submitted after the user has actively utilized Pro tools, batch conversions, or large file processing during the subscription period.</li>
                      <li><strong>Change of Mind:</strong> Change of mind or failure to read feature descriptions prior to purchasing a Pro Plan.</li>
                      <li><strong>Exceeded Request Window:</strong> Refund requests submitted after 7 calendar days from the date of transaction confirmation.</li>
                      <li><strong>Policy Violation:</strong> Accounts suspended due to uploading malware, copyright infringement, or violation of our Terms & Conditions.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Decision Logic Matrix */}
            <section className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                3. Refund Decision Logic Matrix
              </h3>
              <p className="text-muted leading-relaxed">
                Refund requests transition through transparent administrative states:
              </p>

              <div className="table-responsive my-3">
                <table className="table table-bordered align-middle small text-center">
                  <thead className="table-dark">
                    <tr>
                      <th>Status State</th>
                      <th>Definition</th>
                      <th>Pro Access Effect</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="badge bg-primary">REQUESTED</span></td>
                      <td className="text-start">User submitted refund request; awaiting compliance review.</td>
                      <td>Pro Access Active</td>
                    </tr>
                    <tr>
                      <td><span className="badge bg-warning text-dark">UNDER_REVIEW</span></td>
                      <td className="text-start">Compliance team is verifying transaction logs & payment gateway API status.</td>
                      <td>Pro Access Active</td>
                    </tr>
                    <tr>
                      <td><span className="badge bg-success">APPROVED</span></td>
                      <td className="text-start">Request approved; gateway refund API triggered.</td>
                      <td>Pro Access Deactivated</td>
                    </tr>
                    <tr>
                      <td><span className="badge bg-success">REFUNDED</span></td>
                      <td className="text-start">Gateway confirmed money returned to original payment source.</td>
                      <td>Pro Access Revoked</td>
                    </tr>
                    <tr>
                      <td><span className="badge bg-danger">REJECTED</span></td>
                      <td className="text-start">Request evaluated and rejected due to non-eligibility or consumption.</td>
                      <td>Pro Access Unchanged</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 4: Refund Processing Time & Method */}
            <section className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                4. Processing Time & Refund Method
              </h3>
              <p className="text-muted leading-relaxed">
                <strong>4.1 Original Payment Method:</strong> Approved refunds are credited exclusively back to the original source of payment (UPI ID, Credit/Debit Card, or Bank Account) via our payment gateway settlement infrastructure.
              </p>
              <p className="text-muted leading-relaxed">
                <strong>4.2 Processing Timeline:</strong> Once a refund is marked APPROVED, payment gateway and banking settlement channels typically complete the fund transfer within <strong>5 to 7 business days</strong>.
              </p>
            </section>

            {/* Section 5: Subscriptions & Renewals */}
            <section className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                5. Subscription Cancellation vs. Refund
              </h3>
              <p className="text-muted leading-relaxed">
                Cancelling a subscription stops future billing cycles while leaving your active Pro validity intact until its expiration date. Subscription cancellation does NOT automatically trigger a refund for past active periods.
              </p>
            </section>

            {/* Section 6: Contact & Support Procedure */}
            <section className="mb-4">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                6. Refund Support Contact Information
              </h3>
              <p className="text-muted leading-relaxed">
                For questions regarding a refund request or payment status verification, please contact our compliance team:
              </p>
              <div className="bg-light p-4 rounded-4 border font-monospace small">
                <div><strong>Compliance Team:</strong> {business.legal_name} Refund Desk</div>
                <div><strong>Support Email:</strong> <a href={`mailto:${business.support_email}`} className="text-primary">{business.support_email}</a></div>
                <div><strong>Address:</strong> {business.address}</div>
              </div>
            </section>

            <div className="border-top pt-4 text-center">
              <Link to="/terms" className="btn btn-outline-primary rounded-pill px-4 me-2 fw-bold mb-2">
                <i className="bi bi-arrow-left me-1"></i> Terms & Conditions
              </Link>
              {user && (
                <button onClick={() => setRefundModalOpen(true)} className="btn btn-primary rounded-pill px-4 fw-bold mb-2">
                  Submit Refund Request Now
                </button>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* Interactive Refund Request Modal */}
      {refundModalOpen && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', zIndex: 1055 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header bg-dark text-white border-0 px-4 py-3 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <i className="bi bi-arrow-counterclockwise text-primary fs-4 me-2"></i>
                  <h5 className="modal-title fw-bold mb-0">Submit Refund Request</h5>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setRefundModalOpen(false)}
                ></button>
              </div>

              <form onSubmit={handleSubmitRefundRequest}>
                <div className="modal-body p-4">
                  {requestStatusMsg && (
                    <div className={`alert ${requestSuccess ? 'alert-success' : 'alert-danger'} border-0 rounded-3 p-3 mb-4 small fw-semibold`}>
                      {requestStatusMsg}
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label fw-bold small text-muted">Select Paid Order ID *</label>
                    {userPayments.length > 0 ? (
                      <select
                        className="form-select rounded-3 py-2.5"
                        value={selectedOrderId}
                        onChange={handleOrderChange}
                        required
                      >
                        <option value="">-- Choose Order ID from your paid transactions --</option>
                        {userPayments.map(p => (
                          <option key={p.id} value={p.order_id}>
                            {p.order_id} — {p.plan_name} (₹{p.amount}) [{p.created_at}]
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="form-control rounded-3 py-2.5 font-monospace"
                        placeholder="e.g. PPH-2026-8F73A91C2D"
                        value={selectedOrderId}
                        onChange={(e) => setSelectedOrderId(e.target.value)}
                        required
                      />
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold small text-muted">Invoice Number (Optional)</label>
                    <input
                      type="text"
                      className="form-control rounded-3 py-2.5 font-monospace"
                      placeholder="e.g. INV-PPH-2026-8F73A91C2D"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold small text-muted">Reason for Refund Request *</label>
                    <textarea
                      className="form-control rounded-3 p-3"
                      rows="4"
                      placeholder="Please describe why you are requesting a refund (e.g., duplicate charge, unactivated transaction, technical issue)..."
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      required
                    ></textarea>
                  </div>

                  <div className="small text-muted border-top pt-3">
                    <i className="bi bi-info-circle me-1"></i>
                    Refund requests are reviewed by our compliance team according to our official policy criteria within 2-3 business days.
                  </div>
                </div>

                <div className="modal-footer bg-light border-0 px-4 py-3">
                  <button
                    type="button"
                    className="btn btn-outline-secondary rounded-pill px-4 fw-bold"
                    onClick={() => setRefundModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary rounded-pill px-5 fw-bold shadow-sm"
                  >
                    {submitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span> Submitting...
                      </>
                    ) : (
                      'Submit Request'
                    )}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
