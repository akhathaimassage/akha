import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import './AdminLayout.css';

function HamburgerButton({ onClick }) {
    return (
        <button onClick={onClick} className="hamburger-btn">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 6H20M4 12H20M4 18H20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
        </button>
    );
}

function AdminLayout() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="admin-layout">
      <Sidebar isOpen={isSidebarOpen} />
      
      <main className="admin-content">
        <div className="mobile-header">
            <HamburgerButton onClick={() => setSidebarOpen(true)} />
        </div>
        
        {isSidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)}></div>}

        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;