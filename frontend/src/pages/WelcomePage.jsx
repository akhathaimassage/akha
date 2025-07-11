import React, { useState } from 'react';
import './HomePage.css';

// ★ แก้ไข Path การ import ให้ถูกต้อง ★
import MainNavbar from '../components/MainNavbar';
import BookingModal from '../components/BookingModal';
import HeroSection from './sections/HeroSection';
import AboutSection from './sections/AboutSection';
import PricesSection from './sections/PricesSection';
import ContactSection from './sections/ContactSection';
import { useAuth } from '../context/AuthContext';
import LoginModal from '../components/LoginModal';

function WelcomePage() {
  const [isBookingModalOpen, setBookingModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const { currentUser, logout } = useAuth(); // เราจะนำไปใช้ใน MainNavbar

  return (
    <div className="homepage-container">
        {/* ส่ง props ที่จำเป็นไปให้ MainNavbar */}
        <MainNavbar 
          currentUser={currentUser} 
          logout={logout}
          onLoginClick={() => setIsLoginModalOpen(true)}
          onBookNowClick={() => setBookingModalOpen(true)} 
        />
        
        <div className="main-content-card">
            <HeroSection onBookNowClick={() => setBookingModalOpen(true)} />
            <AboutSection />
            <PricesSection />
            <ContactSection />
        </div>
        
        <BookingModal isOpen={isBookingModalOpen} onClose={() => setBookingModalOpen(false)} />
        <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );
}

export default WelcomePage;