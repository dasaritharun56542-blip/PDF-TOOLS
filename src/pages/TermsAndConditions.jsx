import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

export default function TermsAndConditions() {
  const [legalConfig, setLegalConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await axios.get('/accounts/api/legal/config/');
        if (res.data && res.data.success) {
          setLegalConfig(res.data);
        }
      } catch (err) {
        console.error('Failed to load legal configuration:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const business = legalConfig?.business || {
    name: 'PDF Powerhouse',
    legal_name: 'PDF Powerhouse Inc.',
    support_email: 'support@pdfpowerhouse.com',
    address: 'Hyderabad, Telangana 500081, India',
    governing_law: 'Laws of the Republic of India (Hyderabad Jurisdiction)'
  };

  const versioning = legalConfig?.versioning || {
    terms_version: '1.0',
    effective_date: 'August 4, 2026',
    last_updated: 'August 4, 2026'
  };

  const plans = legalConfig?.plans || [];

  return (
    <div className="container py-4">
      {/* Header Banner */}
      <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 mb-5 bg-primary text-white text-center position-relative overflow-hidden">
        <div className="position-relative z-1">
          <span className="badge bg-white text-primary rounded-pill px-3 py-2 mb-3 fw-bold small text-uppercase">
            Legal Documentation • Version {versioning.terms_version}
          </span>
          <h1 className="display-5 fw-black mb-2" style={{ fontWeight: 900 }}>
            Terms & Conditions
          </h1>
          <p className="lead mb-0 text-white-50 mx-auto" style={{ maxWidth: '700px' }}>
            Comprehensive Terms of Service governing access to and use of {business.name} platform services, PDF tools, and subscriptions.
          </p>
          <div className="mt-3 small font-monospace text-white-50">
            Effective Date: {versioning.effective_date} | Last Updated: {versioning.last_updated}
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Sidebar Navigation */}
        <div className="col-lg-3 d-none d-lg-block">
          <div className="card border-0 shadow-sm rounded-4 p-3 sticky-top" style={{ top: '100px' }}>
            <h6 className="fw-bold text-dark mb-3 px-2">Table of Contents</h6>
            <nav className="nav flex-column small">
              <a className="nav-link text-muted py-1.5 px-2 hover-primary" href="#sec-1">1. Introduction & Acceptance</a>
              <a className="nav-link text-muted py-1.5 px-2 hover-primary" href="#sec-2">2. Eligibility & Accounts</a>
              <a className="nav-link text-muted py-1.5 px-2 hover-primary" href="#sec-3">3. Acceptable Use & PDF Rules</a>
              <a className="nav-link text-muted py-1.5 px-2 hover-primary" href="#sec-4">4. File Retention & Processing</a>
              <a className="nav-link text-muted py-1.5 px-2 hover-primary" href="#sec-5">5. Plans & Pricing</a>
              <a className="nav-link text-muted py-1.5 px-2 hover-primary" href="#sec-6">6. Gateway & Activation</a>
              <a className="nav-link text-muted py-1.5 px-2 hover-primary" href="#sec-7">7. Cancellation & Refunds</a>
              <a className="nav-link text-muted py-1.5 px-2 hover-primary" href="#sec-8">8. Fraud & Chargebacks</a>
              <a className="nav-link text-muted py-1.5 px-2 hover-primary" href="#sec-9">9. Intellectual Property</a>
              <a className="nav-link text-muted py-1.5 px-2 hover-primary" href="#sec-10">10. Liability & Disclaimer</a>
              <a className="nav-link text-muted py-1.5 px-2 hover-primary" href="#sec-11">11. Governing Law & Contact</a>
            </nav>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="col-lg-9">
          <div className="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
            
            {/* Section 1 */}
            <section id="sec-1" className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                1. Introduction & Acceptance of Terms
              </h3>
              <p className="text-muted leading-relaxed">
                Welcome to <strong>{business.name}</strong> (operated by <strong>{business.legal_name}</strong>). These Terms and Conditions ("Terms", "Agreement") constitute a legally binding agreement between you ("User", "you", or "your") and {business.legal_name} regarding your access to and use of the {business.name} website, applications, automated PDF processing engines, APIs, and subscription services (collectively, the "Service").
              </p>
              <p className="text-muted leading-relaxed">
                By creating an account, uploading documents, purchasing a Pro Subscription, or accessing any part of the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and our <Link to="/refund-policy" className="text-primary fw-semibold">Refund Policy</Link> and <Link to="/privacy-policy" className="text-primary fw-semibold">Privacy Policy</Link>. If you do not agree with these Terms, you must immediately cease all access and use of the Service.
              </p>
            </section>

            {/* Section 2 */}
            <section id="sec-2" className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                2. Eligibility, Account Registration & Security
              </h3>
              <p className="text-muted leading-relaxed">
                <strong>2.1 Eligibility:</strong> You must be at least 18 years of age or the legal age of majority in your jurisdiction to use the Service. By accessing the Service, you represent and warrant that you possess the legal authority to enter into this Agreement.
              </p>
              <p className="text-muted leading-relaxed">
                <strong>2.2 Account Security:</strong> To access certain features, including Pro tools, usage history, and invoice downloads, you must register an account using email OTP or Google OAuth authentication. You are solely responsible for maintaining the confidentiality of your login credentials and for all activities conducted under your account. You agree to notify us immediately at <code>{business.support_email}</code> of any unauthorized use or security breach.
              </p>
              <p className="text-muted leading-relaxed">
                <strong>2.3 Account Termination:</strong> We reserve the right to suspend, lock, or terminate accounts that violate these Terms, engage in abuse, attempt fraudulent payments, or compromise platform security.
              </p>
            </section>

            {/* Section 3 */}
            <section id="sec-3" className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                3. Acceptable Use & PDF File Upload Rules
              </h3>
              <div className="alert alert-warning border-0 rounded-3 p-3 mb-3 small">
                <i className="bi bi-exclamation-triangle-fill me-2 text-warning fs-6"></i>
                <strong>Strict Content Policy:</strong> You retain full ownership of all files uploaded to {business.name}. However, uploading illegal, malicious, or copyright-infringing content is strictly prohibited.
              </div>
              <p className="text-muted leading-relaxed">
                <strong>3.1 User Ownership:</strong> You retain all copyright, title, and ownership rights to documents, images, and files uploaded to the Service. {business.name} does not claim any ownership over your content.
              </p>
              <p className="text-muted leading-relaxed">
                <strong>3.2 User Authorization:</strong> You represent and warrant that you own or have obtained all necessary licenses, permissions, rights, and consents to upload, process, convert, edit, and compress all files submitted to the platform.
              </p>
              <p className="text-muted leading-relaxed">
                <strong>3.3 Prohibited Files & Activities:</strong> You expressly agree NOT to upload or transmit files that contain:
              </p>
              <ul className="text-muted leading-relaxed mb-3">
                <li>Malware, viruses, ransomware, trojans, worms, or exploit payloads;</li>
                <li>Copyrighted material without explicit authorization from the rights holder;</li>
                <li>Fraudulent, forged, illegal, defamatory, or deceptive legal documents;</li>
                <li>Content that violates privacy, intellectual property, or applicable local and international laws;</li>
                <li>Automated bot traffic, reverse engineering attempts, or Denial-of-Service (DoS) vectors.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section id="sec-4" className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                4. Automated File Processing, Retention & Deletion
              </h3>
              <p className="text-muted leading-relaxed">
                <strong>4.1 Automated Processing:</strong> {business.name} operates automated file-processing pipelines (including PDF Editors, Converters, Compression Engines, OCR, and Watermark tools). File processing is performed entirely by automated algorithms without human inspection of document contents.
              </p>
              <p className="text-muted leading-relaxed">
                <strong>4.2 Temporary Storage & Retention Policy:</strong> Uploaded and processed files are stored temporarily on isolated server storage solely for processing and user download purposes. All processed files are subject to automatic permanent deletion according to our configured 24-hour retention lifecycle.
              </p>
              <p className="text-muted leading-relaxed">
                <strong>4.3 User Responsibility:</strong> You are solely responsible for downloading and backing up your processed files immediately upon completion. {business.name} does not guarantee permanent archival or storage of processed documents.
              </p>
            </section>

            {/* Section 5 */}
            <section id="sec-5" className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                5. Subscription Plans, Pricing & Taxes
              </h3>
              <p className="text-muted leading-relaxed">
                <strong>5.1 Free Plan:</strong> Free tier users receive basic access to standard tools, subject to daily processing limits and quota restrictions.
              </p>
              <p className="text-muted leading-relaxed">
                <strong>5.2 Pro Subscription Plans:</strong> Pro Subscriptions unlock unlimited PDF tool operations, high-speed priority servers, large file upload quotas (up to 200MB), ad-free interface, and automatic PDF tax invoice generation.
              </p>
              
              {/* Dynamic Pricing Table */}
              <div className="table-responsive my-4">
                <table className="table table-bordered align-middle text-center small">
                  <thead className="table-dark">
                    <tr>
                      <th>Plan Name</th>
                      <th>Duration</th>
                      <th>Price</th>
                      <th>Currency</th>
                      <th>Tax Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.length > 0 ? (
                      plans.map((p, idx) => (
                        <tr key={idx}>
                          <td className="fw-bold text-dark">{p.name}</td>
                          <td>{p.duration_days} Days</td>
                          <td className="fw-bold text-primary">₹{p.price}</td>
                          <td>{p.currency || 'INR'}</td>
                          <td>Inclusive of 18% GST</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="text-muted">Loading live subscription rates...</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-muted leading-relaxed">
                <strong>5.3 Taxes:</strong> All pricing displayed includes applicable Goods and Services Tax (18% GST) where mandatory under Indian law. Official PDF Tax Invoices are generated automatically for every successful payment.
              </p>
            </section>

            {/* Section 6 */}
            <section id="sec-6" className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                6. Payment Gateway Verification & Activation
              </h3>
              <p className="text-muted leading-relaxed">
                <strong>6.1 Server-Side Verification:</strong> Payments are processed via authorized payment gateway infrastructure (supporting UPI, Cards, Net Banking, and Wallets) with merchant settlement configured to the merchant's eligible Airtel Payments Bank account.
              </p>
              <p className="text-muted leading-relaxed">
                <strong>6.2 Verified Pro Activation:</strong> Pro Subscription activation occurs exclusively upon trusted server-side payment confirmation via cryptographic Gateway Webhooks or Gateway Status Check APIs. Browsing to a payment confirmation page or client-side redirects alone do NOT constitute verified payment.
              </p>
              <p className="text-muted leading-relaxed">
                <strong>6.3 Stackable Subscription Validity:</strong> If you purchase a new plan while an existing Pro subscription is active, the new plan's duration is added directly to your remaining end date, ensuring zero lost validity.
              </p>
            </section>

            {/* Section 7 */}
            <section id="sec-7" className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                7. Cancellation & Refund Policy Reference
              </h3>
              <p className="text-muted leading-relaxed">
                <strong>7.1 Cancellation:</strong> You may cancel or allow your Pro Subscription to expire at any time from your User Dashboard. Cancellation stops future renewals while leaving your current active period intact until expiration.
              </p>
              <p className="text-muted leading-relaxed">
                <strong>7.2 Refund Policy:</strong> Refund requests, eligibility, chargebacks, and return workflows are strictly governed by our dedicated <Link to="/refund-policy" className="text-primary fw-bold">Refund Policy Document</Link>. Refund requests must be submitted formally via our online Refund Request portal within eligible request timeframes.
              </p>
            </section>

            {/* Section 8 */}
            <section id="sec-8" className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                8. Fraud Prevention, Anti-Abuse & Chargebacks
              </h3>
              <p className="text-muted leading-relaxed">
                We employ automated fraud prevention and audit logging mechanisms. If an account is suspected of payment tampering, stolen card usage, duplicate chargeback abuse, or malicious manipulation, {business.name} reserves the right to immediately suspend access, revoke Pro status, and report fraudulent activities to relevant banking partners and authorities.
              </p>
            </section>

            {/* Section 9 */}
            <section id="sec-9" className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                9. Intellectual Property Rights
              </h3>
              <p className="text-muted leading-relaxed">
                All software, code, algorithms, visual interfaces, graphics, logos, trademarks, and branding associated with {business.name} are the exclusive intellectual property of {business.legal_name}. You are granted a limited, non-exclusive, non-transferable license to access and use the platform for personal or internal business document processing.
              </p>
            </section>

            {/* Section 10 */}
            <section id="sec-10" className="mb-5">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                10. Limitation of Liability & Disclaimers
              </h3>
              <p className="text-muted leading-relaxed">
                <strong>10.1 "As-Is" Provision:</strong> The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, whether express or implied. {business.name} does not warrant that document processing will be uninterrupted, error-free, or compatible with every custom PDF specification.
              </p>
              <p className="text-muted leading-relaxed">
                <strong>10.2 Limitation of Liability:</strong> To the maximum extent permitted under applicable law, {business.legal_name} shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of data, revenue, or business interruption resulting from your use of or inability to use the Service.
              </p>
            </section>

            {/* Section 11 */}
            <section id="sec-11" className="mb-4">
              <h3 className="fw-bold text-dark h4 mb-3 border-bottom pb-2">
                11. Governing Law, Dispute Resolution & Contact Information
              </h3>
              <p className="text-muted leading-relaxed">
                <strong>11.1 Governing Law:</strong> These Terms shall be governed by and construed in accordance with the <strong>{business.governing_law}</strong>, without giving effect to any conflict of law principles.
              </p>
              <p className="text-muted leading-relaxed">
                <strong>11.2 Contact Us:</strong> If you have any questions, compliance inquiries, or legal concerns regarding these Terms, please contact our legal compliance team:
              </p>
              <div className="bg-light p-4 rounded-4 border font-monospace small">
                <div><strong>Business Name:</strong> {business.legal_name}</div>
                <div><strong>Support Email:</strong> <a href={`mailto:${business.support_email}`} className="text-primary">{business.support_email}</a></div>
                <div><strong>Registered Address:</strong> {business.address}</div>
                <div><strong>Jurisdiction:</strong> {business.country}</div>
              </div>
            </section>

            <div className="border-top pt-4 text-center">
              <Link to="/refund-policy" className="btn btn-outline-primary rounded-pill px-4 me-2 fw-bold mb-2">
                View Refund Policy <i className="bi bi-arrow-right ms-1"></i>
              </Link>
              <Link to="/contact" className="btn btn-light rounded-pill px-4 fw-bold mb-2">
                Contact Compliance Team
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
