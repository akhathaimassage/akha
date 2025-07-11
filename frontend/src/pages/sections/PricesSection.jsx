import React from 'react';
// เราไม่จำเป็นต้องดึงข้อมูลจาก API ใน Component นี้แล้ว
// เพราะเราจะแสดงผลแบบ fixed ตามดีไซน์

function PricesSection() {
  // สร้างข้อมูลตัวอย่างสำหรับแสดงผล
  const servicesData = [
    { 
      icon: '/images/icon-thai.png', 
      title: 'Klassische Thai-Massage',
      items: [
         { duration: '60 Min', price: '45 €' },
        { duration: '90 Min', price: '55 €' },
        { duration: '120 Min', price: '80 €' },
        { duration: '120 Min', price: '100 €' },
      ]
    },
    { 
      icon: '/images/thai-sport.png', 
      title: 'Thai-Sportmassage',
      items: [
         { duration: '60 Min', price: '45 €' },
        { duration: '90 Min', price: '55 €' },
        { duration: '120 Min', price: '80 €' },
        { duration: '120 Min', price: '100 €' },
      ]
    },
    { 
      icon: '/images/nacken.png', 
      title: 'Schulter und Nacken-Massage',
      items: [
         { duration: '60 Min', price: '45 €' },
        { duration: '90 Min', price: '55 €' },
        { duration: '120 Min', price: '80 €' },
        { duration: '120 Min', price: '100 €' },
      ]
    },
    { 
      icon: '/images/aroma.png', 
      title: 'Aroma-Öl / Öl-Massage',
      items: [
         { duration: '60 Min', price: '45 €' },
        { duration: '90 Min', price: '55 €' },
        { duration: '120 Min', price: '80 €' },
        { duration: '120 Min', price: '100 €' },
      ]
    },
    { 
      icon: '/images/4-hand.png', 
      title: '4-Hände-Massage',
      items: [
        { duration: '60 Min', price: '110 €' },
        { duration: '90 Min', price: '160 €' },
        { duration: '120 Min', price: '200 €' },
      ]
    },
    
    // ... เพิ่มบริการอื่นๆ ตามต้องการ ...
  ];

  return (
    <section id="prices" className="page-section">
      <h2 className="section-title">Angebote & Preise</h2>
      <div className="prices-grid-container">
        {/* Card 1: รูปภาพ */}
        <div className="price-card-image">
          <img src="/images/prices-main.jpg" alt="Massage Details" />
        </div>

        {/* Card 2-6: บริการ */}
        {servicesData.map((service, index) => (
          <div key={index} className="price-card-service">
            <div className="price-card-header">
              <img src={service.icon} alt={`${service.title} icon`} className="card-icon" />
              <h3>{service.title}</h3>
            </div>
            <ul className="price-card-body">
              {service.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <span>{item.duration}</span>
                  <span className="price-dots"></span>
                  <span>{item.price}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export default PricesSection;