import React from 'react';

function AboutSection() {
    return (
        <section id="about" className="page-section about-section">
            <div className="about-content">
                <h2 className="section-title">Über Uns</h2>
                <p>
                    Bei Akha Thai Massage bieten wir eine Oase der Ruhe, in der Sie dem Stress des Alltags entfliehen können. Unser Team von zertifizierten und erfahrenen Therapeuten widmet sich Ihrem Wohlbefinden und verwendet authentische thailändische Techniken, die seit Generationen weitergegeben werden.
                </p>
            </div>
            <div className="about-image">
                <img src="/images/abouts.png" alt="Massage Details" />
            </div>
        </section>
    );
}

export default AboutSection;