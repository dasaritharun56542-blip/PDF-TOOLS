import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminFilterStatus, setAdminFilterStatus] = useState('all');

  const fetchDashboardData = async () => {
    try {
      const res = await axios.get('/api/dashboard-data/');
      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
      // Safe fallback data to ensure UI always renders seamlessly
      setData({
        total: 0,
        file_count: 0,
        trial_used: false,
        processed_files: [],
        uploaded_files: [],
        plan_name: 'Free Forever',
        is_premium: false,
        days_left: 0,
        trial_active: false,
        trial_days_remaining: 0,
        today_duration_seconds: 0,
        today_remaining_seconds: 1800,
        today_remaining_minutes: 30,
        expiry_date: null,
        payments: [],
        admin_stats: null
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminVerifyAction = async (paymentId, action) => {
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt('Enter rejection reason for this payment verification:', 'Transaction ID (UTR) details could not be verified.');
      if (reason === null) return;
    }

    try {
      const res = await axios.post('/accounts/admin/verify-payment/', {
        payment_id: paymentId,
        action: action,
        rejection_reason: reason
      });

      if (res.data.success) {
        alert(res.data.message);
        fetchDashboardData();
      } else {
        alert(res.data.error || 'Failed to update payment status.');
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to process admin verification request.');
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/accounts/login');
      } else {
        fetchDashboardData();
      }
    }
  }, [user, authLoading, navigate]);

  if (authLoading || (loading && !data)) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-2 text-muted">Loading dashboard...</p>
      </div>
    );
  }

  const {
    total = 0,
    processed_files = [],
    uploaded_files = [],
    file_count = 0,
    trial_used = false,
    plan_name = 'Free Forever',
    is_premium = false,
    days_left = 0,
    trial_active = false,
    trial_days_remaining = 0,
    today_duration_seconds = 0,
    today_remaining_seconds = 1800,
    today_remaining_minutes = 30,
    expiry_date = null,
    payments = [],
    admin_stats = null
  } = data || {};

  return (
    <div className="container py-5">
      {/* Admin overview dashboard */}
      {admin_stats && (
        <div className="card border-0 shadow-sm rounded-4 mb-5 p-4 bg-light" data-aos="fade-down">
          <h2 className="h5 fw-bold mb-4 text-dark d-flex align-items-center">
            <i className="bi bi-shield-lock-fill me-2 text-primary"></i>
            Admin Overview Portal
          </h2>
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="bg-white p-3 rounded-4 shadow-sm border border-light">
                <div className="small text-muted fw-bold">TOTAL USERS</div>
                <div className="h3 fw-bold text-primary mb-0">{admin_stats.total_users}</div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="bg-white p-3 rounded-4 shadow-sm border border-light">
                <div className="small text-muted fw-bold">PREMIUM MEMBERS</div>
                <div className="h3 fw-bold text-warning mb-0">{admin_stats.premium_users}</div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="bg-white p-3 rounded-4 shadow-sm border border-light">
                <div className="small text-muted fw-bold">ACTIVE TRIALS</div>
                <div className="h3 fw-bold text-success mb-0">{admin_stats.trial_users}</div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="bg-white p-3 rounded-4 shadow-sm border border-light">
                <div className="small text-muted fw-bold">TOTAL REVENUE</div>
                <div className="h3 fw-bold text-info mb-0">₹{admin_stats.revenue}</div>
              </div>
            </div>
          </div>
          <div className="row g-3">
            <div className="col-md-6">
              <div className="bg-white p-3 rounded-4 shadow-sm border border-light h-100">
                <h6 className="fw-bold mb-3 text-secondary">Subscribers Registry</h6>
                <ul className="list-unstyled mb-0 small">
                  <li className="mb-2">Active Subscriptions: <strong>{admin_stats.active_subscriptions}</strong></li>
                  <li className="mb-2">Expired Subscriptions: <strong>{admin_stats.expired_subscriptions}</strong></li>
                  <li className="mb-0">Failed Payments Count: <strong>{admin_stats.failed_payments}</strong></li>
                </ul>
              </div>
            </div>
            <div className="col-md-6">
              <div className="bg-white p-3 rounded-4 shadow-sm border border-light h-100">
                <h6 className="fw-bold mb-3 text-secondary">System Tool Analytics</h6>
                <div className="d-flex flex-wrap gap-2">
                  {Object.entries(admin_stats.tool_analytics || {}).map(([tool, count]) => (
                    <span key={tool} className="badge bg-secondary-subtle text-secondary rounded px-2 py-1 small">
                      {tool}: {count}
                    </span>
                  ))}
                  {Object.keys(admin_stats.tool_analytics || {}).length === 0 && (
                    <span className="text-muted small">No operations processed yet.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Admin Payment Audit Table */}
          {admin_stats.recent_transactions && admin_stats.recent_transactions.length > 0 && (
            <div className="mt-4 bg-white p-4 rounded-4 shadow-sm border border-light">
              <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mb-3 gap-3">
                <div>
                  <h6 className="fw-bold text-dark mb-1 d-flex align-items-center">
                    <i className="bi bi-receipt me-2 text-primary fs-5"></i>
                    Automatic Payment Invoices & Audit Log
                  </h6>
                  <p className="small text-muted mb-0">Server-synchronized invoice records, user metadata, and transaction audit trails.</p>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-primary-subtle text-primary rounded-pill px-3 py-2 fw-bold">
                    {admin_stats.recent_transactions.length} Total Records
                  </span>
                </div>
              </div>

              {/* Search & Filter Controls */}
              <div className="row g-2 mb-3">
                <div className="col-md-8">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-light border-end-0">
                      <i className="bi bi-search text-muted"></i>
                    </span>
                    <input
                      type="text"
                      className="form-control form-control-sm border-start-0 ps-0"
                      placeholder="Search by Email, Name, Invoice #, Order ID, Txn ID, or Plan..."
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                    />
                    {adminSearch && (
                      <button className="btn btn-outline-secondary btn-sm" onClick={() => setAdminSearch('')}>
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="col-md-4">
                  <select
                    className="form-select form-select-sm"
                    value={adminFilterStatus}
                    onChange={(e) => setAdminFilterStatus(e.target.value)}
                  >
                    <option value="all">All Payment Statuses</option>
                    <option value="success">SUCCESS (Paid & Activated)</option>
                    <option value="pending">PENDING</option>
                    <option value="failed">FAILED</option>
                    <option value="refunded">REFUNDED</option>
                  </select>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0 small">
                  <thead>
                    <tr className="table-light text-uppercase text-muted">
                      <th>Customer Details</th>
                      <th>Invoice / Receipt #</th>
                      <th>Order & Txn IDs</th>
                      <th>Plan Purchased</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date / Expiry</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admin_stats.recent_transactions
                      .filter(txn => {
                        const matchesStatus = adminFilterStatus === 'all' || txn.status.toLowerCase() === adminFilterStatus.toLowerCase();
                        const q = adminSearch.toLowerCase().trim();
                        const matchesQuery = !q ||
                          (txn.username && txn.username.toLowerCase().includes(q)) ||
                          (txn.email && txn.email.toLowerCase().includes(q)) ||
                          (txn.invoice_number && txn.invoice_number.toLowerCase().includes(q)) ||
                          (txn.order_id && txn.order_id.toLowerCase().includes(q)) ||
                          (txn.transaction_id && txn.transaction_id.toLowerCase().includes(q)) ||
                          (txn.plan_name && txn.plan_name.toLowerCase().includes(q));
                        return matchesStatus && matchesQuery;
                      })
                      .map((txn, index) => (
                        <tr key={index}>
                          <td>
                            <div className="fw-bold text-dark">{txn.username}</div>
                            <div className="text-muted fs-7">{txn.email}</div>
                          </td>
                          <td>
                            <div className="fw-bold text-primary font-monospace">{txn.invoice_number || `INV-${txn.order_id}`}</div>
                            <div className="text-muted fs-7 font-monospace">{txn.receipt_number || `REC-${txn.order_id}`}</div>
                          </td>
                          <td>
                            <div className="text-dark font-monospace fs-7">ORD: {txn.order_id}</div>
                            <div className="text-muted font-monospace fs-7">TXN: {txn.transaction_id}</div>
                          </td>
                          <td>
                            <span className="fw-semibold text-dark">{txn.plan_name}</span>
                          </td>
                          <td>
                            <span className="fw-bold text-success">₹{txn.amount}</span>
                          </td>
                          <td>
                            <span className={`badge rounded-pill ${
                              txn.status === 'success' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'
                            } px-2.5 py-1 fw-bold`}>
                              {txn.status.toUpperCase()}
                            </span>
                          </td>
                          <td>
                            <div className="text-muted fs-7">{txn.created_at}</div>
                            {txn.expiry_date && txn.expiry_date !== 'N/A' && (
                              <div className="text-primary fs-7 fw-semibold">Exp: {txn.expiry_date.split(' ')[0]}</div>
                            )}
                          </td>
                          <td className="text-end">
                            <div className="d-flex justify-content-end align-items-center gap-1">
                              {txn.status === 'pending' && (
                                <>
                                  <button
                                    className="btn btn-success btn-sm px-2 py-0.5 fs-7 fw-bold"
                                    onClick={() => handleAdminVerifyAction(txn.id, 'approve')}
                                    title="Approve manual payment & activate PRO"
                                  >
                                    <i className="bi bi-check-lg me-1"></i> Approve
                                  </button>
                                  <button
                                    className="btn btn-outline-danger btn-sm px-2 py-0.5 fs-7 fw-bold"
                                    onClick={() => handleAdminVerifyAction(txn.id, 'reject')}
                                    title="Reject manual payment"
                                  >
                                    <i className="bi bi-x-lg me-1"></i> Reject
                                  </button>
                                </>
                              )}
                              {txn.invoice_id ? (
                                <>
                                  <a
                                    href={`/accounts/download-invoice/${txn.invoice_id}/`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-outline-secondary btn-sm px-2 py-0.5 fs-7"
                                    title="Preview PDF Invoice in browser"
                                  >
                                    <i className="bi bi-eye"></i> Preview
                                  </a>
                                  <a
                                    href={`/accounts/download-invoice/${txn.invoice_id}/`}
                                    className="btn btn-primary btn-sm px-2 py-0.5 fs-7"
                                    download
                                    title="Download Tax Invoice PDF"
                                  >
                                    <i className="bi bi-download"></i> PDF
                                  </a>
                                </>
                              ) : txn.status !== 'pending' && (
                                <span className="text-muted fs-7">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    {admin_stats.recent_transactions.filter(txn => {
                      const matchesStatus = adminFilterStatus === 'all' || txn.status.toLowerCase() === adminFilterStatus.toLowerCase();
                      const q = adminSearch.toLowerCase().trim();
                      return matchesStatus && (!q || (txn.username && txn.username.toLowerCase().includes(q)) || (txn.email && txn.email.toLowerCase().includes(q)) || (txn.order_id && txn.order_id.toLowerCase().includes(q)));
                    }).length === 0 && (
                      <tr>
                        <td colSpan="8" className="text-center py-4 text-muted">
                          No matching invoices or payment records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header Section */}
      <div className="row mb-5 align-items-center" data-aos="fade-down">
        <div className="col-md-7">
          <h5 className="text-primary fw-bold mb-1">Account Overview</h5>
          <h1 className="display-5 fw-bold text-dark">Welcome back, {user?.username}</h1>
        </div>
        <div className="col-md-5 mt-4 mt-md-0">
          <div className="card border-0 shadow-sm rounded-4 overflow-hidden" style={{ background: '#fdfdfd' }}>
            <div className="d-flex align-items-center p-3">
              <div
                className={`p-3 rounded-circle me-3 ${
                  is_premium ? 'bg-warning-subtle text-warning' : 'bg-secondary-subtle text-secondary'
                }`}
              >
                <i className={`bi ${is_premium ? 'bi-star-fill' : 'bi-person-badge'} fs-4`}></i>
              </div>
              <div className="flex-grow-1">
                <div className="small text-muted fw-bold text-uppercase opacity-75">Membership Status</div>
                <div
                  className={`fw-black ${is_premium ? 'text-warning' : 'text-secondary'}`}
                  style={{ fontWeight: 900, letterSpacing: '-0.5px' }}
                >
                  {is_premium ? (
                    plan_name === 'Free Trial' ? (
                      <>
                        FREE TRIAL{' '}
                        <span className="badge bg-success text-white rounded-pill ms-1 fw-bold" style={{ fontSize: '0.65rem' }}>
                          {days_left} Days Left
                        </span>
                      </>
                    ) : (
                      <>
                        PRO MEMBER{' '}
                        <span className="badge bg-warning text-dark rounded-pill ms-1 fw-bold" style={{ fontSize: '0.65rem' }}>
                          {days_left} Days Left
                        </span>
                      </>
                    )
                  ) : (
                    trial_active ? (
                      <>
                        FREE TRIAL{' '}
                        <span className="badge bg-success text-white rounded-pill ms-1 fw-bold" style={{ fontSize: '0.65rem' }}>
                          {trial_days_remaining} Days Left
                        </span>
                      </>
                    ) : 'FREE FOREVER'
                  )}
                </div>
              </div>
              {(!is_premium || plan_name === 'Free Trial') && (
                <div className="ms-auto text-end">
                  <Link to="/accounts/pricing" className="btn btn-primary btn-sm rounded-pill fw-bold">
                    Upgrade
                  </Link>
                </div>
              )}
            </div>
            {is_premium && (
              <div className="px-3 pb-2 text-end">
                <Link to="/accounts/pricing" className="small text-primary text-decoration-none fw-bold">
                  Renew / Extend Plan <i className="bi bi-arrow-right small"></i>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="row g-4 mb-5">
        <div className="col-md-4" data-aos="fade-up">
          <div className="card border-0 shadow-sm p-4 rounded-4 h-100">
            <div className="d-flex align-items-center mb-3">
              <div className="bg-primary-subtle p-2 rounded-3 me-3 text-primary">
                <i className="bi bi-cpu fs-4"></i>
              </div>
              <span className="text-muted fw-semibold">Total Operations</span>
            </div>
            <div className="display-4 fw-bold text-dark">{total}</div>
            <div className="progress mt-4 bg-light" style={{ height: '6px' }}>
              <div className="progress-bar bg-primary" style={{ width: '100%' }}></div>
            </div>
          </div>
        </div>
        <div className="col-md-4" data-aos="fade-up">
          <div className="card border-0 shadow-sm p-4 rounded-4 h-100">
            <div className="d-flex align-items-center mb-3">
              <div className="bg-success-subtle p-2 rounded-3 me-3 text-success">
                <i className="bi bi-files fs-4"></i>
              </div>
              <span className="text-muted fw-semibold">Files Generated</span>
            </div>
            <div className="display-4 fw-bold text-dark">{file_count}</div>
            <div className="progress mt-4 bg-light" style={{ height: '6px' }}>
              <div className="progress-bar bg-success" style={{ width: '100%' }}></div>
            </div>
          </div>
        </div>
        <div className="col-md-4" data-aos="fade-up">
          <div className="card border-0 shadow-sm p-4 rounded-4 h-100">
            <div className="d-flex align-items-center mb-3">
              <div className="bg-warning-subtle p-2 rounded-3 me-3 text-warning">
                <i className="bi bi-lightning-charge fs-4"></i>
              </div>
              <span className="text-muted fw-semibold">Daily Quota limit</span>
            </div>
            <div className="display-4 fw-bold text-dark">
              {(is_premium && plan_name !== 'Free Trial') ? 'Unlimited' : (trial_active ? `${today_remaining_minutes} min` : '0 min (Upgrade)')}
            </div>
            <div className="progress mt-4 bg-light" style={{ height: '6px' }}>
              <div
                className="progress-bar bg-warning"
                style={{ width: (is_premium && plan_name !== 'Free Trial') ? '100%' : `${Math.min(100, (today_remaining_seconds / 1800.0) * 100.0)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Activity List */}
        <div className="col-lg-8" data-aos="fade-right">
          <div className="card border-0 shadow-sm rounded-4 mb-4">
            <div className="p-4 border-bottom d-flex justify-content-between align-items-center">
              <h3 className="h5 mb-0 fw-bold">Recent Processing History</h3>
              <span className="badge bg-light text-muted border px-3">{processed_files?.length || 0} Total</span>
            </div>
            <div className="p-4">
              <div className="activity-list" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {processed_files && processed_files.length > 0 ? (
                  processed_files.map((f) => (
                    <div
                      key={f.id}
                      className="d-flex align-items-center p-3 mb-3 border rounded-3 hover-shadow-sm transition-all"
                    >
                      <div className="bg-light p-2 rounded-3 me-4">
                        <i className="bi bi-file-earmark-pdf text-primary fs-3"></i>
                      </div>
                      <div className="flex-grow-1">
                        <div className="text-dark fw-bold mb-1">{f.filename}</div>
                        <div className="small text-muted">
                          <span className="text-primary fw-semibold">{f.tool_used.toUpperCase()}</span> • {f.process_date}
                        </div>
                      </div>
                      <div className="ms-3 text-end">
                        <div
                          className={`badge rounded-pill ${
                            f.status === 'completed' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'
                          } text-uppercase px-3 py-2 mb-2`}
                        >
                          {f.status}
                        </div>
                        {f.status === 'completed' && (
                          <a
                            href={`/download/${f.id}/`}
                            download
                            className="d-block btn btn-link btn-sm text-decoration-none p-0"
                          >
                            <i className="bi bi-download me-1"></i>Download
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-5">
                    <i className="bi bi-folder2-open display-2 text-muted opacity-25 mb-3 d-block"></i>
                    <p className="text-muted">No processing history found.</p>
                    <Link to="/" className="btn btn-primary btn-sm rounded-pill mt-2">
                      Start Processing
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Launch */}
        <div className="col-lg-4" data-aos="fade-left">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="p-4 border-bottom">
              <h3 className="h5 mb-0 fw-bold">Quick Launch</h3>
            </div>
            <div className="p-4">
              <div className="d-grid gap-3">
                <Link to="/tool/merge" className="btn btn-light border p-3 text-start rounded-4 hover-bg-primary">
                  <i className="bi bi-intersect text-primary me-3 fs-5"></i>
                  <span className="fw-bold">Merge PDF</span>
                </Link>
                <Link to="/tool/compress" className="btn btn-light border p-3 text-start rounded-4 hover-bg-primary">
                  <i className="bi bi-file-zip text-success me-3 fs-5"></i>
                  <span className="fw-bold">Compress PDF</span>
                </Link>
                <Link to="/tool/pdf-to-jpg" className="btn btn-light border p-3 text-start rounded-4 hover-bg-primary">
                  <i className="bi bi-file-earmark-image text-warning me-3 fs-5"></i>
                  <span className="fw-bold">PDF to Image</span>
                </Link>
                <Link to="/" className="btn btn-primary py-3 rounded-pill mt-3 fw-bold shadow-sm">
                  Browse All Tools
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Billing & Payment History */}
      {payments && payments.length > 0 && (
        <div className="card border-0 shadow-sm rounded-4 mt-5 mb-4" data-aos="fade-up">
          <div className="p-4 border-bottom">
            <h3 className="h5 mb-0 fw-bold">Billing & Invoices</h3>
          </div>
          <div className="p-4">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th className="text-muted small text-uppercase">Order ID</th>
                    <th className="text-muted small text-uppercase">Plan</th>
                    <th className="text-muted small text-uppercase">Amount</th>
                    <th className="text-muted small text-uppercase">Date</th>
                    <th className="text-muted small text-uppercase">Status</th>
                    <th className="text-muted small text-uppercase text-end">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="fw-semibold">{p.order_id}</td>
                      <td>{p.plan_name}</td>
                      <td>₹{p.amount}</td>
                      <td className="text-muted">{p.created_at}</td>
                      <td>
                        <span
                          className={`badge rounded-pill ${
                            p.status === 'success'
                              ? 'bg-success-subtle text-success'
                              : 'bg-danger-subtle text-danger'
                          } px-3 py-2 fw-bold`}
                        >
                          {p.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="text-end">
                        {p.status === 'success' && p.invoice_id ? (
                          <a
                            href={`/accounts/download-invoice/${p.invoice_id}/`}
                            download
                            className="btn btn-outline-primary btn-sm rounded-pill px-3"
                          >
                            <i className="bi bi-file-earmark-pdf me-1"></i> Invoice
                          </a>
                        ) : (
                          <span className="text-muted small">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .hover-shadow-sm:hover {
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
            border-color: #4f46e5 !important;
        }
        .transition-all {
            transition: all 0.2s ease;
        }
        .hover-bg-primary:hover {
            background: #f8fafc;
            border-color: #4f46e5 !important;
        }
      `}} />
    </div>
  );
}
