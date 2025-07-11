import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

function Sidebar({ isOpen }) { 
  return (
    <aside className={`sidebar ${isOpen ? 'is-open' : ''}`}>
      <div className="sidebar-header">
        Admin Panel
      </div>
      <nav className="sidebar-nav">
        <NavLink to="/admin/dashboard">
          <span>Dashboard</span>
        </NavLink>
        <NavLink to="/admin/schedule">
          <span>Schedule</span>
        </NavLink>
        <NavLink to="/admin/therapists">
          <span>Therapists</span>
        </NavLink>
        <NavLink to="/admin/services">
          <span>Services</span>
        </NavLink>
        <NavLink to="/admin/bookings">
          <span>Bookings</span>
        </NavLink>
        <NavLink to="/admin/users">
          <span>Users</span>
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <a href="/" target="_blank" rel="noopener noreferrer">View Booking Page</a>
      </div>
    </aside>
  );
}

export default Sidebar;