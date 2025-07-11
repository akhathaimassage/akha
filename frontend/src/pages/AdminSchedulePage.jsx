import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import "./AdminSchedule.css";
import ScheduleGrid from '../components/ScheduleGrid';
import MobileScheduleView from '../components/MobileScheduleView';
import dayjs from 'dayjs';
import { authFetch } from '../api/authFetch';

const useWindowSize = () => {
  const [size, setSize] = useState([window.innerWidth, window.innerHeight]);
  useEffect(() => {
    const handleResize = () => setSize([window.innerWidth, window.innerHeight]);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return { width: size[0], height: size[1] };
};

function AdminSchedulePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [therapists, setTherapists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOnlyBooked, setShowOnlyBooked] = useState(false); // แก้ไข typo จาก onst เป็น const

  const { width } = useWindowSize();
  const isMobile = width < 768;

  const fetchData = useCallback(async () => {
    const controller = new AbortController();
    const signal = controller.signal;

    console.log("Fetching latest schedule data...");
    const dateString = dayjs(selectedDate).format('YYYY-MM-DD');
    
    try {
        const [bookingsRes, therapistsRes] = await Promise.all([
            authFetch(`/api/admin/bookings_by_date?date=${dateString}`, { signal }),
            authFetch(`/api/therapists`, { signal })
        ]);

        if (!bookingsRes.ok || !therapistsRes.ok) {
            throw new Error('Network response was not ok');
        }

        const bookingsData = await bookingsRes.json();
        const therapistsData = await therapistsRes.json();
        
        setBookings(bookingsData);
        setTherapists(therapistsData);

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("Failed to fetch schedule data", error);
        }
    } finally {
        setIsLoading(false);
    }
    
    return () => {
        controller.abort();
    };
  }, [selectedDate]);

  useEffect(() => {
    setIsLoading(true);
    fetchData();
    const intervalId = setInterval(fetchData, 1000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  // สร้าง list ของพนักงานที่จะแสดงผลโดยดูจาก state
  const displayedTherapists = useMemo(() => {
    if (!showOnlyBooked) {
      return therapists; // ถ้าปิด toggle ให้แสดงทั้งหมด
    }
    // ถ้าเปิด toggle ให้กรอง
    const bookedTherapistIds = new Set(bookings.map(b => b.therapist_id));
    return therapists.filter(t => bookedTherapistIds.has(t.id));
  }, [therapists, bookings, showOnlyBooked]);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Today's Schedule</h1>
        <div className="datepicker-container">
          <DatePicker 
            selected={selectedDate} 
            onChange={(date) => setSelectedDate(date)} 
            dateFormat="MMMM d, yyyy"
          />
        </div>
        
        <div className="view-toggle">
          <label>
            <input 
              type="checkbox"
              checked={showOnlyBooked}
              onChange={(e) => setShowOnlyBooked(e.target.checked)}
            />
            Show only therapists with bookings
          </label>
        </div>
      </div>
      
      <hr className="divider"/>
      
      {isLoading ? (
        <p style={{textAlign: 'center'}}>Loading schedule...</p>
      ) : (
        therapists.length > 0 ? (
            isMobile ? (
              <MobileScheduleView bookings={bookings} therapists={displayedTherapists} />
            ) : (
              <ScheduleGrid bookings={bookings} therapists={displayedTherapists} />
            )
        ) : (
          <p style={{textAlign: 'center'}}>No active therapists found.</p>
        )
      )}
    </div>
  );
}

export default AdminSchedulePage;