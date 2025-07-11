import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ServiceSelector from './ServiceSelector';
import TherapistSelector from './TherapistSelector';
import DateTimePicker from './DateTimePicker';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import './BookingModal.css';
import dayjs from 'dayjs';
import { authFetch } from '../api/authFetch'; //  << 1. เพิ่มบรรทัดนี้ (แก้ path ถ้าจำเป็น)

function BookingModal({ isOpen, onClose }) {
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
        const isEmailValid = customerEmail && customerEmail.includes('@');
        return (
            customerName.trim() !== '' && isEmailValid && customerPhone &&
            selectedDurationId && selectedTherapist && selectedSlot && !isSubmitting
        );
    }, [customerName, customerEmail, customerPhone, selectedDurationId, selectedTherapist, selectedSlot, isSubmitting]);
    
    // Fetch initial data only when modal opens
    useEffect(() => {
        if (isOpen) {
            const fetchServices = async () => {
                try {
                    const res = await authFetch('/api/services'); // << 2. แก้ไขตรงนี้
                    const data = await res.json();
                    const grouped = data.reduce((acc, s) => { if (!acc[s.name]) acc[s.name] = []; acc[s.name].push(s); return acc; }, {});
                    setGroupedServices(grouped);
                } catch (e) { console.error(e); }
            };
            const fetchTherapists = async () => {
                try {
                    const res = await authFetch('/api/therapists'); // << 3. แก้ไขตรงนี้
                    const data = await res.json();
                    setTherapists(data);
                } catch (e) { console.error(e); }
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
                const response = await authFetch(url); // << 4. แก้ไขตรงนี้
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
            const response = await authFetch('/api/bookings', { // << 5. แก้ไขตรงนี้
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(bookingDetails) 
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to book.');
            
            alert('Booking successful! Thank you.');
            onClose(); 
        } catch (error) {
            alert(`Booking failed: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="booking-modal-overlay" onClick={onClose}>
            <div className="booking-modal-card" onClick={e => e.stopPropagation()}>
                
                <div className="card-header-image">
                    <img src="/images/akha-logo.png" alt="Logo" className="logo" />
                    <button className="close-button" type="button" onClick={onClose}>&times;</button>
                    <header className="form-header">
                        <h1>Termin Buchen</h1>
                        <p className="subtitle">Bitte Service auswählen</p>
                    </header>
                </div>
                
                <div className="card-body">
                    <form className="booking-form" onSubmit={handleBookingSubmit}>
                        <div className="form-column">
                            <div className="form-group"><label>Vollständiger Name</label><input type="text" required value={customerName} onChange={e => setCustomerName(e.target.value)} /></div>
                            <div className="form-group"><label>Telefon</label><PhoneInput international defaultCountry="DE" value={customerPhone} onChange={setCustomerPhone}/></div>
                            <div className="form-group"><label>E-mail</label><input type="email" required value={customerEmail} onChange={e => setEmail(e.target.value)} /></div>
                            <div className="form-group"><ServiceSelector groupedServices={groupedServices} selectedService={selectedService} onServiceChange={(e) => setSelectedService(e.target.value)} availableDurations={availableDurations} selectedDuration={selectedDurationId} onDurationChange={(e) => setSelectedDurationId(e.target.value)} /></div>
                            <div className="form-group"><TherapistSelector therapists={therapists} selectedTherapist={selectedTherapist} onChange={(e) => setSelectedTherapist(e.target.value)} /></div>
                            <div className="form-group">
                                <label htmlFor="timeslot-select">Freizeit</label>
                                <select id="timeslot-select" value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)} disabled={availableSlots.length === 0}>
                                    <option value="">-- Verfügbare Zeiten --</option>
                                    {availableSlots.map(slot => (<option key={slot} value={slot}>{slot}</option>))}
                                </select>
                            </div>
                        </div>
                        <div className="form-column">
                            <div className="form-group"><DateTimePicker selectedDate={selectedDate} onDateChange={(date) => setSelectedDate(date)} /></div>
                            <button type="submit" className="submit-button" disabled={!isFormValid}>
                               {isSubmitting ? 'Submitting...' : 'Buchen Sie jetzt'}
                            </button>
                        </div>
                    </form>
                </div>

            </div>
        </div>
    );
}

export default BookingModal;