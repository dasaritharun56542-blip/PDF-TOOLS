import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function PrivacyPolicy() {
  const [legalConfig, setLegalConfig] = useState(null);

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

  const versioning = legalConfig?.versioning || {
    privacy_policy_version: '1.0',
    effective_date: 'August 4, 2026',
    last_updated: 'August 4, 2026'
  };

  return (
    <div className="container py-4">
      {/* Header Banner */}
      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 mb-5 bg-success text-white text-center position-relative overflow-hidden">
        <div className="position-relative z-1">
          <span className="badge bg-white text-success rounded-pill px-3 py-2 mb-3 fw-bold small text-uppercase">
            Privacy & Security • Version {versioning.privacy_policy_version}
          </span>
          <h1 className="display-5 fw-black mb-2" style={{ fontWeight: 900 }}>
            Privacy Policy
          </h1>
          <p className="lead mb-0 text-white-50 mx-auto" style={{ maxWidth: '700px' }}>
            We prioritize your privacy and data security. Learn how {business.name} handles, protects, and automatically deletes your documents.
          </p>
          <div className="mt-3 small font-monospace text-white-50">
            Effective Date: {versioning.effective_date} | Last Updated: {versioning.last_updated}
          </div>
        </div>
      </div>

      <div className="row justify-content-center">
        <div className="col-lg-10">
          <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
            
            <section className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                1. Information We Collect
              </h3>
              <p className="text-muted leading-relaxed">
                <strong>1.1 Account Information:</strong> When you sign up or log in, we collect your email address, username, and account profile information via email OTP or Google OAuth authentication.
              </p>
              <p className="text-muted leading-relaxed">
                <strong>1.2 Document Data:</strong> Uploaded PDF documents, images, and converted files are collected solely to execute requested automated operations (editing, merging, compressing, converting, or running OCR).
              </p>
              <p className="text-muted leading-relaxed">
                <strong>1.3 Technical Logs:</strong> We log basic server metadata (IP address, browser user-agent, and tool usage timestamps) for security auditing, fraud prevention, and rate-limiting.
              </p>
            </section>

            <section className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                2. Automated 24-Hour File Deletion & Security
              </h3>
              <div className="alert alert-success border-0 rounded-3 p-3 mb-3 small">
                <i className="bi bi-shield-lock-fill me-2 text-success fs-6"></i>
                <strong>Automated Deletion Guarantee:</strong> Uploaded and processed documents are stored temporarily on encrypted isolated servers and are permanently deleted automatically after 24 hours.
              </div>
              <p className="text-muted leading-relaxed">
                <strong>2.1 SSL Encryption:</strong> All data transmissions between your browser and our servers are encrypted using 256-bit SSL (TLS 1.3) protocol.
              </p>
              <p className="text-muted leading-relaxed">
                <strong>2.2 No Third-Party File Sharing:</strong> Your document contents are never sold, shared, rented, or made accessible to third parties or AI training pipelines.
              </p>
            </section>

            <section className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                3. Payment Information Security
              </h3>
              <p className="text-muted leading-relaxed">
                {business.name} does not store credit card numbers, CVVs, or UPI PINs on our servers. All transaction billing is securely processed by certified payment gateways.
              </p>
            </section>

            <section className="mb-4">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                4. Contact Privacy Team
              </h3>
              <p className="text-muted leading-relaxed">
                If you have questions about your privacy rights or data protection, please email us:
              </p>
              <div className="bg-light p-4 rounded-4 border font-monospace small">
                <div><strong>Data Protection Officer:</strong> {business.legal_name} Privacy Desk</div>
                <div><strong>Support Email:</strong> <a href={`mailto:${business.support_email}`} className="text-primary">{business.support_email}</a></div>
                <div><strong>Address:</strong> {business.address}</div>
              </div>
            </section>

            <div className="border-top pt-4 text-center">
              <Link to="/terms" className="btn btn-outline-primary rounded-pill px-4 me-2 fw-bold mb-2">
                Terms & Conditions
              </Link>
              <Link to="/refund-policy" className="btn btn-outline-secondary rounded-pill px-4 fw-bold mb-2">
                Refund Policy
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
