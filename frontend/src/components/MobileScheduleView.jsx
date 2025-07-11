import React from 'react';
import dayjs from 'dayjs';
import './ScheduleGrid.css';

function MobileScheduleView({ bookings }) {
  if (bookings.length === 0) {
    return <p style={{ textAlign: 'center', marginTop: '20px' }}>No bookings for this date.</p>;
  }

  return (
    <div style={{ padding: '10px' }}>
      {bookings.map(booking => (
        <div key={booking.id} className="booking-block" style={{ position: 'static', width: 'auto', margin: '10px 0', padding: '10px 15px' }}>
          
          {/* ★ แก้ไข style ที่ div นี้ ★ */}
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: '8px', marginBottom: '8px' }}>
            <span style={{fontWeight: 'bold', fontSize: '1.1em'}}>
              {dayjs(booking.start_datetime).format('HH:mm')}
            </span>
            <span style={{opacity: 0.9}}>
              {booking.therapist_name} 
            </span>
          </div>

          <strong>{booking.service_name}</strong>
          <p>{booking.duration_minutes} Min</p>
          <p style={{ marginTop: '8px', fontSize: '0.8em', opacity: 0.9 }}>
            {booking.customer_name}
          </p>
        </div>
      ))}
    </div>
  );
}

export default MobileScheduleView;