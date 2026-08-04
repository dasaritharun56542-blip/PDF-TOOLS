import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GROUPED_TOOLS } from '../utils/tools';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async (e) => {
    e.preventDefault();
    await logout();
    navigate('/');
  };

  const [isMegaOpen, setIsMegaOpen] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState({ left: 0, top: 0, width: 0 });
  const liRef = React.useRef(null);
  const closeTimeoutRef = React.useRef(null);
  const [width, setWidth] = React.useState(window.innerWidth);

  React.useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const calculatePosition = () => {
    if (!liRef.current) return;
    const liRect = liRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    
    // We want the mega menu to be wide (e.g. 1100px) but fit within the viewport
    const menuWidth = Math.min(1140, viewportWidth - 32);
    
    // Center the menu relative to the hovered navigation item
    const itemCenter = liRect.left + liRect.width / 2;
    let left = itemCenter - menuWidth / 2;
    
    // Prevent overflow on left/right edges
    if (left < 16) left = 16;
    if (left + menuWidth > viewportWidth - 16) {
      left = viewportWidth - menuWidth - 16;
    }
    
    // Anchor directly below the navbar bottom
    const navbarElement = liRef.current.closest('.navbar');
    const top = navbarElement ? navbarElement.getBoundingClientRect().height : liRect.bottom;

    setMenuPosition({
      left: left,
      top: top,
      width: menuWidth
    });
  };

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    calculatePosition();
    setIsMegaOpen(true);
  };

  const handleMouseLeave = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsMegaOpen(false);
    }, 200); // 200ms close delay to bridge the hover gap
  };

  React.useEffect(() => {
    const handleUpdate = () => {
      if (isMegaOpen) {
        calculatePosition();
      }
    };
    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate);
    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate);
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [isMegaOpen]);

  const isDesktop = () => {
    return width >= 992;
  };

  const getLinkStyle = () => {
    if (width >= 992 && width < 1200) {
      return { fontSize: '0.72rem', paddingLeft: '3px', paddingRight: '3px', letterSpacing: '0.01em', fontWeight: 600 };
    }
    return { fontSize: '0.78rem', paddingLeft: '6px', paddingRight: '6px', fontWeight: 600 };
  };

  const getSideStyle = () => {
    if (width >= 1200) {
      return { minWidth: '180px', display: 'flex', flexShrink: 0, margin: 0 };
    }
    if (width >= 992) {
      return { minWidth: '150px', display: 'flex', flexShrink: 0, margin: 0 };
    }
    return {};
  };

  return (
    <nav className="navbar navbar-expand-lg border-bottom sticky-top py-0 bg-white shadow-sm">
      <div className="container-fluid px-3 px-lg-4" style={width >= 992 ? { display: 'flex', alignItems: 'center', minHeight: '72px' } : {}}>
        {/* Logo */}
        <Link className="navbar-brand d-flex align-items-center py-3 me-0" to="/" style={width >= 992 ? { ...getSideStyle(), alignItems: 'center' } : {}}>
          <img
            src="/static/images/logo_circle.png"
            alt="PDF Powerhouse"
            className="brand-logo me-2"
            style={{ width: '32px', height: '32px' }}
          />
          <span className="fw-bold text-dark fs-5 fs-lg-4">
            PDF <span className="text-primary fw-normal">POWERHOUSE</span>
          </span>
        </Link>

        {/* Mobile Toggle */}
        <button
          className="navbar-toggler border-0 shadow-none"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="navbarNav" style={width >= 992 ? { display: 'flex', alignItems: 'center', flexGrow: 1 } : {}}>
          {/* Centered Main Links */}
          <ul className="navbar-nav mx-auto align-items-center">
            <li className="nav-item">
              <Link className="nav-link nav-link-custom mx-1" to="/" style={getLinkStyle()}>HOME</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link nav-link-custom mx-1" to="/accounts/pricing" style={getLinkStyle()}>PRICING</Link>
            </li>

            {/* Separator for grouping */}
            <li className="d-none d-lg-block mx-2 text-muted opacity-25">|</li>

            <li className="nav-item">
              <Link className="nav-link nav-link-custom mx-1" to="/tool/merge" style={getLinkStyle()}>MERGE</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link nav-link-custom mx-1" to="/tool/split" style={getLinkStyle()}>SPLIT</Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link nav-link-custom mx-1" to="/tool/compress" style={getLinkStyle()}>COMPRESS</Link>
            </li>

            {/* Convert Dropdown */}
            <li className="nav-item dropdown">
              <a
                className="nav-link nav-link-custom mx-1 dropdown-toggle"
                href="#"
                id="convertDropdown"
                role="button"
                data-bs-toggle="dropdown"
                style={getLinkStyle()}
              >
                CONVERT
              </a>
              <ul className="dropdown-menu border-0 shadow-lg p-3">
                <li>
                  <h6 className="dropdown-header text-uppercase small fw-bold text-primary">PDF Conversion</h6>
                </li>
                <li><Link className="dropdown-item rounded-3 py-2" to="/tool/pdf-to-jpg">PDF to JPG</Link></li>
                <li><Link className="dropdown-item rounded-3 py-2" to="/tool/pdf-to-pdfa">PDF to PDF/A</Link></li>
              </ul>
            </li>

            {/* All Tools Mega Menu */}
            <li
              ref={liRef}
              className="nav-item position-static"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <a
                className="nav-link text-primary fw-bold text-uppercase mx-1 dropdown-toggle"
                href="#"
                id="allToolsDropdown"
                role="button"
                style={getLinkStyle()}
              >
                ALL PDF TOOLS
              </a>
              <div
                className="dropdown-menu mega-menu border-0 shadow-lg py-5"
                style={isDesktop() ? {
                  position: 'absolute',
                  left: `${menuPosition.left}px`,
                  top: `${menuPosition.top}px`,
                  width: `${menuPosition.width}px`,
                  display: isMegaOpen ? 'block' : 'none',
                  zIndex: 1050
                } : {
                  display: isMegaOpen ? 'block' : 'none'
                }}
              >
                <div className="container">
                  <div className="row g-4">
                    {Object.entries(GROUPED_TOOLS).map(([catSlug, catData]) => (
                      <div className="col-md-2" key={catSlug}>
                        <h6 className="text-uppercase small fw-bold text-muted mb-4 border-bottom pb-2">
                          {catData.name}
                        </h6>
                        <ul className="list-unstyled">
                          {catData.tools.map((tool) => (
                            <li className="mb-3" key={tool.slug}>
                              <Link
                                to={`/tool/${tool.slug}`}
                                className="text-decoration-none d-flex align-items-center tool-link"
                                onClick={() => setIsMegaOpen(false)}
                              >
                                <div
                                  className="icon-wrap me-2 bg-light rounded text-center"
                                  style={{ width: '24px', height: '24px' }}
                                >
                                  <i className={`bi ${tool.icon} text-primary`} style={{ fontSize: '0.8rem' }}></i>
                                </div>
                                <span className="text-dark small fw-bold">{tool.name}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </li>
            {user && (
              <>
                <li className="nav-item">
                  <Link className="nav-link nav-link-custom mx-1" to="/dashboard" style={getLinkStyle()}>DASHBOARD</Link>
                </li>
                {user.is_staff && (
                  <li className="nav-item">
                    <a className="nav-link nav-link-custom mx-1 text-danger fw-bold" href="/admin/" style={getLinkStyle()}>ADMIN SITE</a>
                  </li>
                )}
              </>
            )}
          </ul>

          {/* Right side (Auth/Action) */}
          <ul className="navbar-nav align-items-center ms-auto" style={width >= 992 ? { display: 'flex', flexShrink: 0, justifyContent: 'flex-end', alignItems: 'center' } : { justifyContent: 'flex-end' }}>
            {user ? (
              <>
                <li className="nav-item d-flex align-items-center me-2" style={{ flexShrink: 1, minWidth: 0 }}>
                  {user.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt={user.google_name || user.username} 
                      className="rounded-circle me-1 border border-2 border-warning shadow-sm"
                      style={{ width: '30px', height: '30px', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div 
                      className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center me-1 fw-bold shadow-sm"
                      style={{ width: '30px', height: '30px', fontSize: '0.75rem', flexShrink: 0 }}
                    >
                      {(user.google_name || user.username).substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="d-flex flex-column text-start me-1 lh-sm" style={{ minWidth: 0 }}>
                    <div className="d-flex align-items-center gap-1">
                      <span className="fw-bold text-dark text-truncate" style={{ fontSize: '0.75rem', maxWidth: '85px' }}>
                        {user.google_name || user.username}
                      </span>
                      {user.is_pro && (
                        <span 
                          className="badge text-dark fw-bold shadow-sm flex-shrink-0" 
                          style={{ 
                            background: 'linear-gradient(135deg, #FFD700 0%, #FF8C00 100%)', 
                            color: '#000000',
                            fontSize: '0.58rem', 
                            padding: '0.15rem 0.35rem',
                            borderRadius: '4px',
                            fontWeight: 800,
                            letterSpacing: '0.03em',
                            boxShadow: '0 2px 4px rgba(255, 140, 0, 0.35)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px'
                          }}
                        >
                          <i className="bi bi-star-fill text-dark" style={{ fontSize: '0.5rem' }}></i>
                          PRO
                        </span>
                      )}
                    </div>
                  </div>
                </li>
                <li className="nav-item flex-shrink-0">
                  <form onSubmit={handleLogout} className="d-inline">
                    <button 
                      type="submit" 
                      className="btn btn-outline-danger rounded-pill px-2.5 py-1 fw-bold d-inline-flex align-items-center gap-1 shadow-sm"
                      style={{ fontSize: '0.72rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                      <i className="bi bi-box-arrow-right" style={{ fontSize: '0.75rem' }}></i>
                      LOGOUT
                    </button>
                  </form>
                </li>
              </>
            ) : (
              <>
                <li className="nav-item">
                  <Link className="nav-link nav-link-custom" to="/accounts/login">Login</Link>
                </li>
                <li className="nav-item ms-lg-3">
                  <Link
                    className="btn btn-danger rounded-pill px-4 fw-bold shadow-sm"
                    to="/accounts/signup"
                    style={{ backgroundColor: '#e53e3e' }}
                  >
                    Sign up
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
}
