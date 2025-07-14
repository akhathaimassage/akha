import React, { useState, useEffect } from 'react';
import { authFetch } from '../../api/authFetch'; // ตรวจสอบ path ให้ถูกต้อง

// Component ย่อยสำหรับแสดงการ์ดแต่ละบริการ
const ServiceCard = ({ icon, title, items }) => (
    <div className="price-card-service">
        <div className="price-card-header">
            <img src={icon} alt={`${title} icon`} className="card-icon" />
            <h3>{title}</h3>
        </div>
        <ul className="price-card-body">
            {items.map((item, itemIndex) => (
                <li key={itemIndex}>
                    <span>{item.duration}</span>
                    <span className="price-dots"></span>
                    <span>{item.price}</span>
                </li>
            ))}
        </ul>
    </div>
);


function PricesSection() {
    const [serviceGroups, setServiceGroups] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchServices = async () => {
            try {
                const response = await authFetch('/api/services');
                if (!response.ok) throw new Error('Failed to fetch services');
                const data = await response.json();

                const grouped = data.reduce((acc, service) => {
                    const serviceName = service.name;
                    if (!acc[serviceName]) {
                        acc[serviceName] = {
                            icon: getIconForService(serviceName),
                            title: serviceName,
                            items: []
                        };
                    }
                    acc[serviceName].items.push({
                        duration: `${service.duration_minutes} Min`,
                        price: `${parseInt(service.price)} €`,
                        duration_minutes: service.duration_minutes
                    });
                    return acc;
                }, {});
                
                Object.values(grouped).forEach(group => {
                    group.items.sort((a, b) => a.duration_minutes - b.duration_minutes);
                });

                setServiceGroups(grouped);
            } catch (error) {
                console.error("Error fetching services:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchServices();
    }, []);

    const getIconForService = (serviceName) => {
        if (serviceName.includes('Thai-Massage')) return '/images/icon-thai.png';
        if (serviceName.includes('Thai-Sportmassage')) return '/images/thai-sport.png';
        if (serviceName.includes('Nacken-Massage')) return '/images/nacken.png';
        if (serviceName.includes('Aroma-Öl')) return '/images/aroma.png';
        if (serviceName.includes('4-Hände-Massage')) return '/images/4-hand.png';
        return '/images/default-icon.png';
    };

    if (isLoading) {
        return <p>Loading prices...</p>;
    }

    return (
        <section id="prices" className="page-section">
            <h2 className="section-title">Angebote & Preise</h2>
            {/* ★★★ แก้ไขโครงสร้าง JSX ให้กลับไปเหมือนดีไซน์เดิมของคุณ ★★★ */}
            <div className="prices-grid-container">
                <div className="price-card-image">
                    <img src="/images/prices-main.jpg" alt="Massage Details" />
                </div>
                
                {Object.values(serviceGroups).map(group => (
                    <ServiceCard key={group.title} icon={group.icon} title={group.title} items={group.items} />
                ))}
            </div>
        </section>
    );
}

export default PricesSection;