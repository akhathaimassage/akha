import React from 'react';

function HeroSection({ onBookNowClick }) {
    return (
        <section id="hero" className="hero-section">
            <div className="hero-grid">
                <div className="hero-image-card">
                    <img src="/images/hero.png" alt="Akha Thai Massage" />
                </div>
                <div className="hero-text-card">
                    <h1>Herzlich Willkommen bei der Akha Thai Massage in Tiengen!</h1>
                    <p>Mein Name ist Kanthita, aber Familie und Freunde nennen mich Paeng. Ich komme aus Chiang Rai in Nordthailand und verfüge über jahrelange Erfahrung in der traditionellen Thaimassage. Auch mein Team besteht ausschließlich aus zertifizierten Fachkräften aus Thailand, die bestens in dieser jahrhundertealten Kunst ausgebildet sind.</p>
                    
                    {/* ★ แก้ไขโครงสร้างที่นี่ ★ */}
                    <div className="hero-contact-line">
                        <span>Rufen Sie uns an</span>
                        
                        {/* ไอคอนโทรศัพท์ (SVG) */}
                        <svg className="phone-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>

                        <a href="tel:+4915151646555" className="contact-phone-number">+49 (0) 151 51 646 555</a>
                    </div>

                    <button onClick={onBookNowClick} className="hero-cta-button">Jetzt Termin Buchen</button>
                </div>
            </div>
        </section>
    );
}

export default HeroSection;