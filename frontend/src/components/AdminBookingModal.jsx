import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ServiceSelector from './ServiceSelector';
import TherapistSelector from './TherapistSelector';
import DateTimePicker from './DateTimePicker';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import './BookingModal.css';
import dayjs from 'dayjs';
import { authFetch } from '../api/authFetch';

function AdminBookingModal({ isOpen, onClose, onSave }) {
    const [groupedServices, setGroupedServices] = useState({});
    const [therapists, setTherapists] = useState([]);
    const [selectedService, setSelectedService] = useState('');
    const [selectedDurationId, setSelectedDurationId] = useState('');
    const [selectedTherapist, setSelectedTherapist] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedSlot, setSelectedSlot] = useState('');
    const [availableDurations, setAvailableDurations] = useState([]);
    const [availableSlots, setAvailableSlots] = useState([]);
    const [customerName, setCustomerName] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerPhone, setCustomerPhone] = useState();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isFormValid = useMemo(() => {
        return (
            customerName.trim() !== '' &&
            customerPhone &&
            selectedDurationId &&
            selectedTherapist &&
            selectedSlot &&
            !isSubmitting
        );
    }, [customerName, customerPhone, selectedDurationId, selectedTherapist, selectedSlot, isSubmitting]);

    useEffect(() => {
        if (isOpen) {
            const fetchServices = async () => {
                const res = await authFetch('/api/services');
                const data = await res.json();
                const grouped = data.reduce((acc, s) => {
                    if (!acc[s.name]) acc[s.name] = [];
                    acc[s.name].push(s);
                    return acc;
                }, {});
                setGroupedServices(grouped);
            };
            const fetchTherapists = async () => {
                const res = await authFetch('/api/therapists');
                const data = await res.json();
                setTherapists(data);
            };
            fetchServices();
            fetchTherapists();
        }
    }, [isOpen]);
    
    useEffect(() => { 
        if (selectedService && groupedServices[selectedService]) { 
            setAvailableDurations(groupedServices[selectedService]); 
        } else { 
            setAvailableDurations([]); 
        } 
        setSelectedDurationId(''); 
    }, [selectedService, groupedServices]);
    
    useEffect(() => {
        if (!selectedDurationId || !selectedTherapist || !selectedDate) {
            setAvailableSlots([]);
            return;
        }
        const fetchAvailability = async () => {
            const dateString = dayjs(selectedDate).format('YYYY-MM-DD');
            const url = `/api/availability?date=${dateString}&serviceId=${selectedDurationId}&therapistId=${selectedTherapist}`;
            try {
                // ▼▼▼  แก้ไขบรรทัดนี้  ▼▼▼
                const response = await authFetch(url);
                // ▲▲▲  แก้ไขบรรทัดนี้  ▲▲▲
                const slots = await response.json();
                setAvailableSlots(Array.isArray(slots) ? slots : []);
                setSelectedSlot('');
            } catch (e) {
                console.error('Failed to fetch availability:', e);
                setAvailableSlots([]);
            }
        };
        fetchAvailability();
    }, [selectedDurationId, selectedTherapist, selectedDate]);

    const handleBookingSubmit = async (event) => {
        event.preventDefault();
        if (!isFormValid) return;
        setIsSubmitting(true);
        
        const bookingDetails = { 
            serviceId: selectedDurationId, 
            therapistId: selectedTherapist, 
            date: dayjs(selectedDate).format('YYYY-MM-DD'),
            time: selectedSlot,
            customerName, 
            customerEmail, 
            customerPhone 
        };

        try {
            const response = await authFetch('/api/bookings', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bookingDetails)
            });
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Failed to create booking.');
            }
            alert('Booking created successfully!');
            onSave();
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="booking-modal-overlay" onClick={onClose}>
            <div className="booking-modal-card" onClick={e => e.stopPropagation()}>
                <div className="card-header-image">
                    <button className="close-button" type="button" onClick={onClose}>&times;</button>
                    <header className="form-header">
                        <h1>Add New Booking</h1>
                    </header>
                </div>
                <div className="card-body">
                    <form className="booking-form" onSubmit={handleBookingSubmit}>
                        <div className="form-column">
                            <div className="form-group"><label>Customer Name</label><input type="text" required value={customerName} onChange={e => setCustomerName(e.target.value)} /></div>
                            <div className="form-group"><label>Customer Phone</label><PhoneInput international defaultCountry="DE" required value={customerPhone} onChange={setCustomerPhone}/></div>
                            <div className="form-group">
                                <label>E-mail (Optional)</label>
                                <input 
                                    type="email" 
                                    value={customerEmail} 
                                    onChange={e => setCustomerEmail(e.target.value)}
                                />
                            </div>
                            <div className="form-group"><ServiceSelector groupedServices={groupedServices} selectedService={selectedService} onServiceChange={(e) => setSelectedService(e.target.value)} availableDurations={availableDurations} selectedDuration={selectedDurationId} onDurationChange={(e) => setSelectedDurationId(e.target.value)} /></div>
                        </div>
                        <div className="form-column">
                            <div className="form-group"><TherapistSelector therapists={therapists} selectedTherapist={selectedTherapist} onChange={(e) => setSelectedTherapist(e.target.value)} /></div>
                            <div className="form-group">
                                <label htmlFor="timeslot-select">Time Slot</label>
                                <select id="timeslot-select" value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)} disabled={availableSlots.length === 0} required>
                                    <option value="">-- Select Time --</option>
                                    {availableSlots.map(slot => (<option key={slot} value={slot}>{slot}</option>))}
                                </select>
                            </div>
                            <div className="form-group"><DateTimePicker selectedDate={selectedDate} onDateChange={(date) => setSelectedDate(date)} /></div>
                            <button type="submit" className="submit-button" disabled={!isFormValid}>
                               {isSubmitting ? 'Saving...' : 'Save Booking'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default AdminBookingModal;