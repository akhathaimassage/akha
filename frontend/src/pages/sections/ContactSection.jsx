import React from 'react';

function ContactSection() {
    return (
        <section id="contact" className="page-section contact-section">
            <h2 className="section-title">Kontakt & Standort</h2>
            <div className="contact-grid-3-col">

                {/* Column 1: Contact Info */}
                <div className="contact-column">
                    <h3>Kontaktinformationen</h3>
                    <p>Hauptstraße 31, 79761<br/>Tiengen, Deutschland</p>
                    <p><strong>Telefon:</strong> <a href="tel:0+49 (0) 151 51 646 555">+49 (0) 151 51 646 555</a></p>
                    <p><strong>E-Mail:</strong> <a href="mailto:info@akhathaimassage.de">info@akhathaimassage.de</a></p>
                    <h4>Öffnungszeiten</h4>
                    <p>Mo - Sa: 09:00 - 19:00 Uhr<br/>So: Geschlossen</p>
                </div>

                {/* Column 2: Social & QR Code */}
                <div className="contact-column">
                    <h3>Folgen Sie uns</h3>
                    <div className="social-links">
                        <a href="https://www.facebook.com/share/12F9qCihLp2/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer">
                            <img src="/images/facebook-icon.png" alt="Facebook" /> Akha Thai Massage
                        </a>
                    </div>
                    
                    <div className="qr-code-section">
                        <h4>WhatsApp</h4>
                        <a href="https://wa.me/4915151646555" target="_blank" rel="noopener noreferrer">
                            <img src="/images/whatsapp-qr.png" alt="WhatsApp QR Code" />
                        </a>
                    </div>
                </div>

                {/* Column 3: Map */}
                <div className="contact-column">
                    <h3>Standort</h3>
                    <div className="contact-map">
                        <iframe 
                            src="https://www.google.com/maps?q=WT-Tiengen+Hauptstra%C3%9Fe+31,+79761+Waldshut-Tiengen,+Germany&hl=en&gl=de&output=embed" 
                            width="100%" 
                            height="300" 
                            style={{ border: 0, borderRadius: '10px' }} 
                            allowFullScreen="" 
                            loading="lazy"
                            title="Google Maps Location"
                        ></iframe>
                    </div>
                </div>

            </div>
        </section>
    );
}

export default ContactSection;