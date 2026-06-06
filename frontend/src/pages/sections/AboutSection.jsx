import React, { useState, useEffect } from 'react';

function AboutSection() {
    // 1. สร้าง State ไว้เก็บข้อมูลพนักงานจาก Database
    const [teamMembers, setTeamMembers] = useState([]);

    // 2. ดึงข้อมูลทันทีที่เปิดหน้านี้
    useEffect(() => {
        const fetchTeam = async () => {
            try {
                // ยิงไปที่ API ฝั่ง Public (ลูกค้า) ที่เราดักไว้แล้วว่าเอาเฉพาะคนที่ is_active = TRUE และ is_deleted = FALSE
                const response = await fetch('https://akha-massage-api.onrender.com/api/therapists');
                const data = await response.json();
                setTeamMembers(data);
            } catch (error) {
                console.error("Failed to fetch team:", error);
            }
        };
        fetchTeam();
    }, []);

    return (
        <section id="about" className="page-section about-section">
            
            {/* ส่วนของ "Über Uns" เนื้อหาเดิม */}
            <div className="about-grid">
                <div className="about-content">
                    <h2 className="section-title">Über Uns</h2>
                    <p>
                        Bei Akha Thai Massage bieten wir eine Oase der Ruhe, in der Sie dem Stress des Alltags entfliehen können. Unser Team von zertifizierten und erfahrenen Therapeuten widmet sich Ihrem Wohlbefinden und verwendet authentische thailändische Techniken, die seit Generationen weitergegeben werden.
                    </p>
                </div>
                <div className="about-image">
                    <img src="/images/abouts.gif" alt="Massage Details" />
                </div>
            </div>

            {/* ▼▼▼ ส่วนแสดงผลทีมงานแบบ Dynamic (ออโต้) ▼▼▼ */}
            <div className="team-container">
                <h3 className="team-title">Unser Team</h3>
                <div className="team-card-layout">
                    {teamMembers.map((member) => (
                        <div key={member.id} className="team-card">
                            {/* 💡 ท่าไม้ตาย: เอาชื่อจาก DB มาประกอบเป็นชื่อไฟล์รูปภาพ */}
                            <img 
                                src={`/images/${member.full_name}.jpg`} 
                                alt={member.full_name} 
                                className="team-member-photo" 
                                // ถ้าหาไฟล์รูปไม่เจอ ให้แสดงรูป default ป้องกันเว็บพัง
                                onError={(e) => { e.target.src = '/images/default-avatar.jpg'; }} 
                            />
                            <p className="team-member-name">{member.full_name}</p>
                        </div>
                    ))}
                </div>
            </div>
            {/* ▲▲▲ จบส่วนที่เพิ่มใหม่ ▲▲▲ */}

        </section>
    );
}

export default AboutSection;