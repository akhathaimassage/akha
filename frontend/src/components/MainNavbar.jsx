import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './MainNavbar.css';

function MainNavbar({ currentUser, logout, onLoginClick, onBookNowClick }) {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false); // ★ State for mobile menu

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const toggleMobileMenu = () => {
        setMobileMenuOpen(!isMobileMenuOpen);
    };

    return (
        <nav className={`main-navbar ${isScrolled ? 'scrolled' : ''}`}>
            <div className="navbar-logo">
                <a href="#hero">
                    <img src="/images/akha-logo-light.png" alt="Akha Thai Massage Logo" />
                </a>
            </div>

            {/* --- Desktop Links --- */}
            <div className="navbar-links desktop-only">
                <a href="#about">Über Uns</a>
                <a href="#prices">Angebote & Preise</a>
                <a href="#contact">Kontakt</a>
            </div>

            {/* --- Desktop CTA / User Menu --- */}
            <div className="navbar-cta desktop-only">
                {currentUser ? (
                    <div className="user-menu">
                      <span>Willkommen, {currentUser.username}!</span>
                      <Link to="/admin/schedule" className="management-button">Management</Link>
                      <button onClick={logout} className="navbar-booking-button logout">Logout</button>
                    </div>
                ) : (
                    <div className="user-menu">
                        <button onClick={onLoginClick} className="navbar-login-button">Login</button>
                        <button onClick={onBookNowClick} className="navbar-booking-button">Termin Buchen</button>
                    </div>
                )}
            </div>

            {/* --- Mobile Hamburger Button --- */}
            <div className="mobile-menu-icon">
                <button onClick={toggleMobileMenu}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 6H20M4 12H20M4 18H20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </button>
            </div>
            
            {/* --- Mobile Menu Dropdown --- */}
            {isMobileMenuOpen && (
                 <div className="mobile-menu-dropdown">
                    <a href="#about" onClick={toggleMobileMenu}>Über Uns</a>
                    <a href="#prices" onClick={toggleMobileMenu}>Angebote & Preise</a>
                    <a href="#contact" onClick={toggleMobileMenu}>Kontakt</a>
                    <div className="mobile-cta-buttons">
                        {currentUser ? (
                             <>
                                <Link to="/admin/schedule" className="management-button">Management</Link>
                                <button onClick={() => { logout(); toggleMobileMenu(); }} className="navbar-booking-button logout">Logout</button>
                             </>
                        ) : (
                            <>
                                <button onClick={() => { onLoginClick(); toggleMobileMenu(); }} className="navbar-login-button">Login</button>
                                <button onClick={() => { onBookNowClick(); toggleMobileMenu(); }} className="navbar-booking-button">Termin Buchen</button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </nav>
    );
}

export default MainNavbar;