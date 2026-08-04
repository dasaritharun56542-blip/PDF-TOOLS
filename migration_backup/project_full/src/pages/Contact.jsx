import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function Contact() {
  const [legalConfig, setLegalConfig] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get('/accounts/api/legal/config/');
        if (res.data && res.data.success) {
          setLegalConfig(res.data);
        }
      } catch (err) {
        console.error('Legal config error:', err);
      }
    };
    fetchConfig();
  }, []);

  const business = legalConfig?.business || {
    name: 'PDF Powerhouse',
    legal_name: 'PDF Powerhouse Inc.',
    support_email: 'support@pdfpowerhouse.com',
    address: 'Hyderabad, Telangana 500081, India'
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
    setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <div className="container py-4">
      {/* Header Banner */}
      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 mb-5 bg-dark text-white text-center position-relative overflow-hidden">
        <div className="position-relative z-1">
          <span className="badge bg-primary text-white rounded-pill px-3 py-2 mb-3 fw-bold small text-uppercase">
            24/7 Support & Legal Desk
          </span>
          <h1 className="display-5 fw-black mb-2" style={{ fontWeight: 900 }}>
            Contact & Support
          </h1>
          <p className="lead mb-0 text-white-50 mx-auto" style={{ maxWidth: '700px' }}>
            Have questions regarding our PDF tools, Pro subscriptions, billing, or compliance? Our team is here to help.
          </p>
        </div>
      </div>

      <div className="row g-4 justify-content-center">
        {/* Contact Info Card */}
        <div className="col-lg-5">
          <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white h-100">
            <h4 className="fw-bold text-dark mb-4 border-bottom pb-2">Business Information</h4>
            
            <div className="d-flex align-items-start mb-4">
              <div className="bg-primary-subtle p-3 rounded-circle me-3 text-primary">
                <i className="bi bi-building fs-4"></i>
              </div>
              <div>
                <h6 className="fw-bold text-dark mb-1">Company Name</h6>
                <p className="text-muted mb-0 small">{business.legal_name}</p>
              </div>
            </div>

            <div className="d-flex align-items-start mb-4">
              <div className="bg-success-subtle p-3 rounded-circle me-3 text-success">
                <i className="bi bi-envelope-at fs-4"></i>
              </div>
              <div>
                <h6 className="fw-bold text-dark mb-1">Customer Support Email</h6>
                <a href={`mailto:${business.support_email}`} className="text-primary fw-semibold small text-decoration-none">
                  {business.support_email}
                </a>
              </div>
            </div>

            <div className="d-flex align-items-start mb-4">
              <div className="bg-warning-subtle p-3 rounded-circle me-3 text-warning">
                <i className="bi bi-geo-alt fs-4"></i>
              </div>
              <div>
                <h6 className="fw-bold text-dark mb-1">Registered Business Address</h6>
                <p className="text-muted mb-0 small leading-relaxed">{business.address}</p>
              </div>
            </div>

            <div className="bg-light p-3.5 rounded-4 border mt-auto">
              <h6 className="fw-bold text-dark mb-2 small text-uppercase">Legal Quick Links</h6>
              <div className="d-flex flex-wrap gap-2 small">
                <Link to="/terms" className="btn btn-sm btn-outline-primary rounded-pill">Terms & Conditions</Link>
                <Link to="/refund-policy" className="btn btn-sm btn-outline-primary rounded-pill">Refund Policy</Link>
                <Link to="/privacy-policy" className="btn btn-sm btn-outline-primary rounded-pill">Privacy Policy</Link>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form Card */}
        <div className="col-lg-7">
          <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white h-100">
            <h4 className="fw-bold text-dark mb-4 border-bottom pb-2">Send Us a Message</h4>

            {submitted && (
              <div className="alert alert-success border-0 rounded-3 p-3 mb-4 fw-semibold small">
                <i className="bi bi-check-circle-fill me-2"></i> Thank you! Your support message has been sent successfully. Our team will get back to you within 24 hours.
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold small text-muted">Your Name *</label>
                  <input
                    type="text"
                    className="form-control rounded-3 py-2.5"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold small text-muted">Email Address *</label>
                  <input
                    type="email"
                    className="form-control rounded-3 py-2.5"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold small text-muted">Subject *</label>
                  <input
                    type="text"
                    className="form-control rounded-3 py-2.5"
                    placeholder="e.g. Account, Subscription, Billing, or Technical Question"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold small text-muted">Message *</label>
                  <textarea
                    className="form-control rounded-3 p-3"
                    rows="5"
                    placeholder="Provide details about your query..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                  ></textarea>
                </div>

                <div className="col-12 text-end">
                  <button type="submit" className="btn btn-primary rounded-pill px-5 py-3 fw-bold shadow-sm">
                    <i className="bi bi-send me-2"></i> Send Message
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
