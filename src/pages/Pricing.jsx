import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Pricing() {
  const { user, checkAuthStatus } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected Plan for PhonePe Modal
  const [activePlan, setActivePlan] = useState(null);
  const [activeOrderId, setActiveOrderId] = useState('');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Official Subscription Plans Definition
  const officialPlans = [
    { id: 'free_trial', days: 7, price: 0, name: '7 Days Free Trial', badge: 'Free Trial', features: ['Access to basic tools', '7 Days full trial', 'Standard processing'] },
    { id: '1_month', days: 30, price: 1, name: '1 Month Pro', badge: 'Most Popular', features: ['Infinite Pro Tool Access', 'Large File Processing (200MB)', 'Ad-Free Clean Interface', '24/7 VIP Support'] },
    { id: '3_months', days: 90, price: 230, name: '3 Months Pro', badge: 'Saver', features: ['Infinite Pro Tool Access', 'Large File Processing (200MB)', 'Ad-Free Clean Interface', '24/7 VIP Support'] },
    { id: '6_months', days: 180, price: 530, name: '6 Months Pro', badge: 'Super Saver', features: ['Infinite Pro Tool Access', 'Large File Processing (200MB)', 'Ad-Free Clean Interface', '24/7 VIP Support'] },
    { id: '1_year', days: 365, price: 999, name: '1 Year Pro', badge: 'Best Value', features: ['Infinite Pro Tool Access', 'Large File Processing (200MB)', 'Ad-Free Clean Interface', '24/7 VIP Support'] }
  ];

  const fetchPricingData = async () => {
    try {
      const res = await axios.get('/api/pricing-data/');
      if (res.data && res.data.plans && res.data.plans.length > 0) {
        setPlans(officialPlans);
      } else {
        setPlans(officialPlans);
      }
    } catch (err) {
      setPlans(officialPlans);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPricingData();
  }, []);

  const handleFreeTrial = async () => {
    if (!user) {
      navigate('/accounts/login?next=/accounts/pricing');
      return;
    }
    try {
      await axios.post('/api/activate-trial/');
      navigate('/dashboard');
    } catch (err) {
      navigate('/dashboard');
    }
  };

  const handleCheckout = async (plan, event) => {
    const sKey = localStorage.getItem('pdf_powerhouse_session_key');
    const savedUser = localStorage.getItem('pdf_powerhouse_user');
    
    if (sKey) {
      axios.defaults.headers.common['X-Session-Key'] = sKey;
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + sKey;
    }

    let uEmail = user?.email;
    let uName = user?.username;
    if (!uEmail && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        uEmail = parsed?.email;
        uName = parsed?.username;
      } catch (e) {}
    }

    const btn = event?.currentTarget;
    let originalHtml = '';
    if (btn) {
      originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating Gateway Order...';
    }

    try {
      const res = await axios.post('/accounts/api/payments/create-order/', { 
        plan_id: plan.id,
        user_email: uEmail || 'dasaritharuntej777@gmail.com',
        username: uName || 'dasari'
      });
      if (res.data && res.data.success) {
        setActivePlan(plan);
        setActiveOrderId(res.data.order_id);
        setPaymentSuccess(false);
        setPaymentMessage('');
        
        // If Razorpay JS SDK is loaded and key is available, launch Razorpay Modal
        if (window.Razorpay && res.data.key_id) {
          try {
            const options = {
              key: res.data.key_id,
              amount: res.data.amount_paise || Math.round(res.data.amount * 100),
              currency: res.data.currency || "INR",
              name: "PDF Powerhouse",
              description: `${plan.name} Subscription`,
              image: "/static/images/logo_circle.png",
              order_id: res.data.razorpay_order_id,
              handler: async function (response) {
                setSubmittingPayment(true);
                try {
                  const verifyRes = await axios.post('/accounts/api/payments/verify/', {
                    order_id: res.data.order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_signature: response.razorpay_signature,
                    user_email: uEmail,
                    username: uName
                  });
                  setPaymentModalOpen(false);
                  if (checkAuthStatus) await checkAuthStatus();
                  navigate(`/accounts/payment-success?order_id=${res.data.order_id}`);
                } catch (vErr) {
                  setPaymentModalOpen(false);
                  if (checkAuthStatus) await checkAuthStatus();
                  navigate(`/accounts/payment-success?order_id=${res.data.order_id}`);
                } finally {
                  setSubmittingPayment(false);
                }
              },
              prefill: {
                email: user?.email || '',
                name: user?.username || ''
              },
              theme: { color: "#3b82f6" }
            };
            const rzp = new window.Razorpay(options);
            rzp.open();
            return;
          } catch (rzpErr) {
            console.warn("Razorpay launch fallback to UPI modal:", rzpErr);
          }
        }

        // If official gateway checkout URL is returned, open or redirect
        if (res.data.checkout_url && res.data.checkout_url.startsWith('http')) {
          window.location.href = res.data.checkout_url;
          return;
        }
        
        setPaymentModalOpen(true);
      } else {
        setActivePlan(plan);
        setPaymentModalOpen(true);
      }
    } catch (err) {
      console.warn('Order creation fallback to payment modal:', err);
      setActivePlan(plan);
      setPaymentModalOpen(true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    }
  };

  const handleVerifyPayment = async () => {
    setSubmittingPayment(true);
    setPaymentMessage('Verifying payment with payment gateway...');
    try {
      const res = await axios.post('/accounts/api/payments/verify/', {
        order_id: activeOrderId
      });
      
      if (res.data && res.data.success && res.data.status === 'SUCCESS') {
        setPaymentSuccess(true);
        setPaymentMessage('Server Verification Confirmed! PRO Activated 🎉');
        if (checkAuthStatus) await checkAuthStatus();
        setTimeout(() => {
          setPaymentModalOpen(false);
          navigate(`/accounts/payment-success?order_id=${activeOrderId}`);
        }, 1200);
      } else {
        setPaymentSuccess(false);
        setPaymentMessage(res.data.error || 'Payment pending gateway confirmation or webhook receipt. Please complete transaction in your app and click verify again.');
      }
    } catch (err) {
      setPaymentSuccess(false);
      setPaymentMessage('Verification check failed. Payment will be automatically updated once webhook arrives.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const copyUpiId = () => {
    navigator.clipboard.writeText('9110396906@ybl');
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-2 text-muted">Loading official plans...</p>
      </div>
    );
  }

  return (
    <>
      <div className="pricing-header text-center mb-5">
        <div className="container" data-aos="fade-up">
          <span className="badge bg-primary-subtle text-primary rounded-pill px-4 py-2 mb-3 fw-bold">
            OFFICIAL SUBSCRIPTION PLANS
          </span>
          <h1 className="display-4 fw-black text-dark mb-3" style={{ fontWeight: 900 }}>
            Upgrade to PDF <span className="text-primary">PRO</span>
          </h1>
          <p className="text-muted lead mx-auto mb-0" style={{ maxWidth: '600px' }}>
            Select your plan to activate unlimited PDF editing, batch conversion, and high-speed processing.
          </p>
        </div>
      </div>

      <div className="container pb-5">
        {/* User Status Banner */}
        {user && (
          <div className="row justify-content-center mb-5">
            <div className="col-12 col-lg-10">
              <div
                className="card border-0 shadow-sm rounded-4 p-4 d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 text-center text-md-start"
                style={{
                  background: '#ffffff',
                  borderLeft: '5px solid #4f46e5'
                }}
              >
                <div className="d-flex flex-column flex-sm-row align-items-center gap-3">
                  <div className="bg-primary-subtle p-3 rounded-circle">
                    <i className="bi bi-person-badge fs-3 text-primary"></i>
                  </div>
                  <div>
                    <h5 className="mb-1 fw-bold">Hello, {user.username}!</h5>
                    {user.is_pro ? (
                      <p className="small text-muted mb-0">
                        <span className="glow-dot"></span>Active PRO Access: <strong>{user.days_left} days remaining</strong>
                      </p>
                    ) : (
                      <p className="small text-muted mb-0">
                        You are currently on the <strong className="text-danger">FREE TIER</strong>.
                      </p>
                    )}
                  </div>
                </div>
                {!user.trial_used && (
                  <div className="text-center text-md-end w-100 w-md-auto">
                    <button onClick={handleFreeTrial} className="btn btn-success rounded-pill px-4 fw-bold w-100 w-md-auto">
                      Activate 7 Days Free
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 5 Official Subscription Plan Cards */}
        <div className="pricing-cards-grid">
          {plans.map((plan) => (
            <div key={plan.id} className="pricing-card-col" data-aos="zoom-in">
              <div className={`card pricing-card shadow-sm ${plan.id === '1_month' ? 'featured' : ''}`}>
                <div className="p-4 text-center">
                  <div className="mb-3" style={{ minHeight: '26px' }}>
                    {plan.badge && (
                      <span className={`plan-badge ${plan.id === '1_year' ? 'bg-dark text-warning' : (plan.id === 'free_trial' ? 'bg-secondary' : '')}`}>
                        {plan.badge}
                      </span>
                    )}
                  </div>

                  <h5 className="fw-bold text-dark text-uppercase small mb-2">{plan.name}</h5>
                  <div className="d-flex justify-content-center align-items-center mb-3">
                    <span className="h3 fw-bold me-1">₹</span>
                    <span className="price-amount">{plan.price}</span>
                  </div>

                  <div className="text-muted small mb-4">
                    {plan.price === 0 ? '7 Days Free Trial' : `Validity for ${plan.days} Days`}
                  </div>

                  <hr className="opacity-10 my-3" />

                  <ul className="list-unstyled text-start mb-4">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="mb-2.5 small d-flex align-items-center">
                        <span className="check-icon me-2">
                          <i className="bi bi-check-lg"></i>
                        </span>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-auto p-4 pt-0">
                  {plan.price === 0 ? (
                    <button
                      onClick={handleFreeTrial}
                      className="btn btn-outline-secondary w-100 py-3 rounded-pill fw-bold"
                    >
                      7 Days Free
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleCheckout(plan, e)}
                      className="btn btn-primary w-100 py-3 rounded-pill fw-bold shadow-sm d-flex align-items-center justify-content-center"
                    >
                      <i className="bi bi-qr-code-scan me-2"></i> Buy Plan — ₹{plan.price}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Security & Trust Guarantee */}
        <div className="row mt-5 pt-4 g-4">
          <div className="col-md-4" data-aos="fade-up">
            <div className="d-flex">
              <i className="bi bi-lock-fill text-primary fs-2 me-3"></i>
              <div>
                <h6 className="fw-bold mb-1">Locked Amount & Static QR</h6>
                <p className="small text-muted">Scan the auto-locked QR for your exact plan price or scan the static PhonePe poster.</p>
              </div>
            </div>
          </div>
          <div className="col-md-4" data-aos="fade-up">
            <div className="d-flex">
              <i className="bi bi-arrow-repeat text-success fs-2 me-3"></i>
              <div>
                <h6 className="fw-bold mb-1">Instant Pro Activation</h6>
                <p className="small text-muted">
                  Subscriptions and PDF tax invoices are generated automatically upon payment confirmation.
                </p>
              </div>
            </div>
          </div>
          <div className="col-md-4" data-aos="fade-up">
            <div className="d-flex">
              <i className="bi bi-layers-half text-warning fs-2 me-3"></i>
              <div>
                <h6 className="fw-bold mb-1">Stackable Validity</h6>
                <p className="small text-muted">Purchasing a new plan automatically extends your current subscription end date.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PhonePe QR Code Payment Modal with Both Locked Amount & Static QR */}
      {paymentModalOpen && activePlan && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(8px)', zIndex: 1055 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              {/* Modal Header */}
              <div className="modal-header bg-dark text-white border-0 px-4 py-3 d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <div className="bg-primary rounded-circle me-2.5 d-inline-flex align-items-center justify-content-center" style={{ width: '28px', height: '28px' }}>
                    <i className="bi bi-qr-code text-white fs-6"></i>
                  </div>
                  <h5 className="modal-title fw-bold mb-0 fs-5">Scan & Pay via PhonePe / UPI</h5>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white opacity-75"
                  onClick={() => setPaymentModalOpen(false)}
                ></button>
              </div>

              {/* Modal Body */}
              <div className="modal-body p-4 text-center">
                {/* Plan Info & Locked Amount Pill */}
                <div className="bg-light p-3 rounded-4 mb-3 border d-flex align-items-center justify-content-between">
                  <div className="text-start">
                    <span className="badge bg-primary-subtle text-primary rounded-pill px-2.5 py-1 small fw-bold mb-1">
                      SELECTED PLAN
                    </span>
                    <h6 className="fw-bold text-dark mb-0">{activePlan.name}</h6>
                  </div>
                  <div className="text-end">
                    <span className="small text-muted d-block font-monospace fw-bold">LOCKED AMOUNT</span>
                    <span className="h3 fw-black text-primary mb-0" style={{ fontWeight: 900 }}>₹{activePlan.price}</span>
                  </div>
                </div>

                {/* Both Locked Amount QR Code & Static PhonePe Poster QR */}
                <div className="row g-3 justify-content-center align-items-stretch mb-3">
                  {/* Option 1: Fixed & Locked Amount QR for this specific plan */}
                  <div className="col-md-6 text-center">
                    <div className="border bg-white p-3 rounded-4 shadow-sm h-100 d-flex flex-column align-items-center justify-content-between">
                      <span className="badge bg-success text-white rounded-pill px-3 py-1 small fw-bold mb-2">
                        LOCKED AMOUNT QR (₹{activePlan.price})
                      </span>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`upi://pay?pa=9110396906@ybl&pn=PDFPOWERHOUSE&tr=${activeOrderId || 'PPH1001'}&am=${Number(activePlan.price).toFixed(2)}&cu=INR&tn=ProPlan`)}`}
                        alt={`Locked Amount UPI QR Code - ₹${activePlan.price}`}
                        className="img-fluid rounded border p-2 bg-white mb-2"
                        style={{ width: '180px', height: '180px' }}
                      />
                      <div className="small text-success fw-bold font-monospace fs-7">
                        <i className="bi bi-lock-fill me-1"></i>Auto-locks ₹{activePlan.price} on scan
                      </div>
                    </div>
                  </div>

                  {/* Option 2: Official Static PhonePe Poster QR */}
                  <div className="col-md-6 text-center">
                    <div className="border bg-dark p-3 rounded-4 shadow-sm h-100 text-white d-flex flex-column align-items-center justify-content-between">
                      <span className="badge bg-primary rounded-pill px-3 py-1 small fw-bold mb-2">
                        STATIC PHONEPE QR
                      </span>
                      <img
                        src="/phonepe_qr.jpg"
                        onError={(e) => { e.target.src = "/static/images/phonepe_qr.jpg"; }}
                        alt="PhonePe QR Code - Ms Dasari Sunitha"
                        className="img-fluid rounded-3 border border-secondary p-1 mb-2"
                        style={{ width: '180px', height: '180px', objectFit: 'contain' }}
                      />
                      <div className="small text-white-50 fw-semibold fs-7">Ms Dasari Sunitha</div>
                    </div>
                  </div>
                </div>

                {/* UPI ID Info with Copy Button */}
                <div className="d-flex align-items-center justify-content-between bg-white border p-2.5 px-3 rounded-3 mb-3 shadow-sm">
                  <div className="text-start">
                    <div className="small text-muted fs-7">UPI ID</div>
                    <div className="fw-bold text-dark font-monospace fs-6">9110396906@ybl</div>
                  </div>
                  <button onClick={copyUpiId} className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold">
                    {copiedUpi ? <><i className="bi bi-check2 me-1"></i>Copied!</> : <><i className="bi bi-copy me-1"></i>Copy UPI</>}
                  </button>
                </div>

                {/* Instructions */}
                <p className="small text-muted mb-3">
                  Scan the <strong>Locked Amount QR</strong> to auto-fill <strong>₹{activePlan.price}</strong> or scan the <strong>Static PhonePe QR</strong> in any UPI app.
                </p>

                <div className="form-check text-start mb-3 bg-light p-2.5 px-3 rounded-3 border">
                  <input
                    className="form-check-input mt-0.5 me-2"
                    type="checkbox"
                    id="modalTermsCheck"
                    defaultChecked
                  />
                  <label className="form-check-label small text-muted" htmlFor="modalTermsCheck">
                    I agree to the <Link to="/terms" target="_blank" className="text-primary fw-semibold">Terms & Conditions</Link> and <Link to="/refund-policy" target="_blank" className="text-primary fw-semibold">Refund Policy</Link>.
                  </label>
                </div>

                {/* Server Payment Verification Action Button */}
                {paymentSuccess ? (
                  <div className="alert alert-success border-0 shadow-sm rounded-3 p-3 mb-0 fw-bold d-flex align-items-center justify-content-center">
                    <i className="bi bi-check-circle-fill me-2 fs-5"></i>
                    <span>{paymentMessage}</span>
                  </div>
                ) : (
                  <div>
                    {paymentMessage && (
                      <div className="alert alert-warning border-0 small py-2 mb-2">
                        {paymentMessage}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleVerifyPayment}
                      disabled={submittingPayment}
                      className="btn btn-primary btn-lg w-100 rounded-pill fw-bold py-3 shadow mb-2"
                    >
                      {submittingPayment ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span> Verifying Server Payment Status...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-shield-check me-2 fs-5"></i> Verify Payment Status (Server Check)
                        </>
                      )}
                    </button>
                    <div className="small text-muted fs-7">
                      Payment is automatically verified via Gateway Webhook and Server Status API.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .pricing-cards-grid {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 1.25rem;
            align-items: stretch;
            width: 100%;
        }
        @media (max-width: 1200px) {
            .pricing-cards-grid {
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 1.25rem;
            }
        }
        @media (max-width: 768px) {
            .pricing-cards-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 1rem;
            }
        }
        @media (max-width: 576px) {
            .pricing-cards-grid {
                grid-template-columns: 1fr; /* Full-width vertical cards on mobile */
                gap: 1.5rem;
            }
        }
        .pricing-card-col {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: 100%;
        }
        .pricing-header {
            background: radial-gradient(circle at top, rgba(79, 70, 229, 0.08) 0%, transparent 70%);
            padding: 60px 0;
            border-radius: 0 0 40px 40px;
        }
        .pricing-card {
            border: 1px solid rgba(0,0,0,0.08);
            border-radius: 20px;
            transition: all 0.3s ease;
            background: #fff;
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .pricing-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 20px 40px rgba(0,0,0,0.1) !important;
            border-color: #4f46e5;
        }
        .pricing-card.featured {
            border: 2px solid #4f46e5;
        }
        .plan-badge {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            padding: 4px 12px;
            border-radius: 50px;
            font-size: 0.68rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .price-amount {
            font-size: 3rem;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: -1.5px;
        }
        .check-icon {
            width: 18px;
            height: 18px;
            background: #e0e7ff;
            color: #4f46e5;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            flex-shrink: 0;
        }
        .glow-dot {
            width: 8px;
            height: 8px;
            background: #10b981;
            border-radius: 50%;
            display: inline-block;
            margin-right: 8px;
            box-shadow: 0 0 10px #10b981;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.5); opacity: 0.5; }
            100% { transform: scale(1); opacity: 1; }
        }
      `}} />
    </>
  );
}
