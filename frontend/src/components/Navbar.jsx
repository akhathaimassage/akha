import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navbar.css';

function Navbar() {
  return (
    <nav className="admin-navbar">
      <div className="nav-logo">
        Admin Panel
      </div>
      <ul className="nav-links">
        <li>
          <NavLink to="/admin/schedule">Schedule</NavLink>
        </li>
        <li>
          <NavLink to="/admin/therapists">Therapists</NavLink>
        </li>
        <li>
          <NavLink to="/admin/services">Services</NavLink>
        </li>
      </ul>
      <div className="nav-actions">
        <a href="/" target="_blank" rel="noopener noreferrer">Go to Booking Page</a>
      </div>
    </nav>
  );
}

export default Navbar;