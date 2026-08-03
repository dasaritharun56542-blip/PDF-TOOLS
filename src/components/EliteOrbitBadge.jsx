import React from 'react';
import { Link } from 'react-router-dom';

export default function EliteOrbitBadge() {
  return (
    <div className="elite-orbit-container">
      <Link to="/accounts/pricing" className="elite-orbit-badge">
        <svg className="orbit-text-svg" viewBox="0 0 200 200">
          <defs>
            <path id="badgeCircle" d="M 100, 100 m -75, 0 a 75,75 0 1,1 150,0 a 75,75 0 1,1 -150,0"></path>
          </defs>
          <text className="rotating-text">
            <textPath xlinkHref="#badgeCircle">
              7 DAYS FREE TRIAL • PRO ACCESS • 7 DAYS FREE TRIAL • PRO ACCESS •
            </textPath>
          </text>
        </svg>
        <div className="orbit-center-icon">
          <i className="bi bi-gift-fill"></i>
        </div>
        <div className="orbit-glow"></div>
      </Link>
    </div>
  );
}
