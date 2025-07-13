import React from 'react';
import './ScheduleGrid.css';
import dayjs from 'dayjs';

function ScheduleGrid({ bookings, therapists }) {
  const startTime = 9;
  const endTime = 19;
  const interval = 30;

  const timeSlots = [];
  for (let hour = startTime; hour < endTime; hour++) {
    timeSlots.push(`${String(hour).padStart(2, '0')}:00`);
    timeSlots.push(`${String(hour).padStart(2, '0')}:${interval}`);
  }
  timeSlots.push(`${String(endTime).padStart(2, '0')}:00`);

  const getRowIndex = (dateTimeString) => {
    const naiveTime = dayjs.utc(dateTimeString);
    const hour = naiveTime.hour();
    const minute = naiveTime.minute();
    const minutesFromStart = (hour - startTime) * 60 + minute;
    return Math.floor(minutesFromStart / interval) + 2;
  };

  // ★ 1. สร้าง Set ของ ID พนักงานที่แสดงผลอยู่ (Active) เพื่อให้ค้นหาได้เร็ว
  const displayedTherapistIds = new Set(therapists.map(t => t.id));

  // ★ 2. กรอง array การจองทั้งหมด ให้เหลือเฉพาะการจองของพนักงานที่ Active
  const filteredBookings = bookings.filter(booking => 
    displayedTherapistIds.has(booking.therapist_id)
  );

  return (
    <div className="schedule-grid-container">
      <div 
        className="schedule-grid"
        style={{ 
          gridTemplateColumns: `100px repeat(${therapists.length}, 1fr)`,
          gridTemplateRows: `auto repeat(${timeSlots.length}, 40px)`
        }}
      >
        <div className="grid-header" style={{ gridRow: 1, gridColumn: 1 }}>Time</div>
        {therapists.map((therapist, index) => (
          <div key={therapist.id} className="grid-header" style={{ gridRow: 1, gridColumn: index + 2 }}>
            {therapist.full_name}
          </div>
        ))}

        {timeSlots.map((time, index) => (
          <React.Fragment key={time}>
            <div className="time-label" style={{ gridRow: index + 2, gridColumn: 1 }}>{time}</div>
            {therapists.map((therapist, therapistIndex) => (
              <div key={`${time}-${therapist.id}`} className="grid-cell" style={{ gridRow: index + 2, gridColumn: therapistIndex + 2 }}></div>
            ))}
          </React.Fragment>
        ))}

        {/* ★ 3. ใช้ `filteredBookings` ในการ map แทน `bookings` เดิม */}
        {filteredBookings.map(booking => {
          const startRow = getRowIndex(booking.start_datetime);
          
          let durationInSlots;
          switch (booking.duration_minutes) {
            case 40:
            case 60:
              durationInSlots = 3;
              break;
            case 90:
              durationInSlots = 4;
              break;
            case 120:
              durationInSlots = 5;
              break;
            default:
              durationInSlots = Math.ceil(booking.duration_minutes / interval);
              break;
          }

          const bookingStyle = {
            gridColumn: therapists.findIndex(t => t.id === booking.therapist_id) + 2,
            gridRow: `${startRow} / span ${durationInSlots}`,
          };

          return (
            <div key={booking.id} className="booking-block" style={bookingStyle}>
              <p style={{fontWeight: 'bold', margin: 2}}>
                {dayjs.utc(booking.start_datetime).format('HH:mm')}
              </p>
              <p style={{fontSize: '0.9em', opacity: 0.9, margin: '4px 0', marginTop: '10px'}}>
                {booking.therapist_name}
              </p>
              <hr style={{width: '80%', border: 'none', borderTop: '1px solid rgba(255,255,255,0.3)', margin: '8px 0'}} />
              <strong>{booking.service_name}</strong>
              <p>{booking.duration_minutes} Min</p>
              <p style={{ marginTop: '5px', fontSize: '0.8em', opacity: 0.9 }}>
                {booking.customer_name}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ScheduleGrid;