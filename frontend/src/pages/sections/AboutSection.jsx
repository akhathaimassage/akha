import React from 'react';


// ★ 1. สร้างข้อมูลของทีมงาน
const teamMembers = [
    {
        name: 'Ane',
        image: '/images/Ane.jpg' // <-- แก้เป็น path รูปของพนักงาน
    },
    {
        name: 'Bee',
        image: '/images/Bee.jpg'
    },
    {
        name: 'Kathin',
        image: '/images/Kathin.jpg'
    }
];

function AboutSection() {
    return (
        <section id="about" className="page-section about-section">
            
            {/* ส่วนของ "Über Uns" เดิมที่แบ่งซ้าย-ขวา */}
            <div className="about-grid">
                <div className="about-content">
                    <h2 className="section-title">Über Uns</h2>
                    <p>
                        Bei Akha Thai Massage bieten wir eine Oase der Ruhe, in der Sie dem Stress des Alltags entfliehen können. Unser Team von zertifizierten und erfahrenen Therapeuten widmet sich Ihrem Wohlbefinden und verwendet authentische thailändische Techniken, die seit Generationen weitergegeben werden.
                    </p>
                </div>
                <div className="about-image">
                    <img src="/images/abouts.png" alt="Massage Details" />
                </div>
            </div>

            {/* ▼▼▼ 2. เพิ่มส่วนแสดงผลทีมงานเข้าไปใหม่ ▼▼▼ */}
            <div className="team-container">
                <h3 className="team-title">Unser Team</h3>
                <div className="team-card-layout">
                    {teamMembers.map((member, index) => (
                        <div key={index} className="team-card">
                            <img src={member.image} alt={member.name} className="team-member-photo" />
                            <p className="team-member-name">{member.name}</p>
                        </div>
                    ))}
                </div>
            </div>
            {/* ▲▲▲ จบส่วนที่เพิ่มใหม่ ▲▲▲ */}

        </section>
    );
}

export default AboutSection;