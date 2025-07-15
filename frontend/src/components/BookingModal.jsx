import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ServiceSelector from './ServiceSelector';
import TherapistSelector from './TherapistSelector';
import DateTimePicker from './DateTimePicker';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input'; // ★ 1. Import ฟังก์ชัน isValidPhoneNumber
import 'react-phone-number-input/style.css';
import './BookingModal.css';
import dayjs from 'dayjs';
import { authFetch } from '../api/authFetch';

function BookingModal({ isOpen, onClose }) {
    const [groupedServices, setGroupedServices] = useState({});
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
    const [isPhoneValid, setIsPhoneValid] = useState(true);

    const [allTherapists, setAllTherapists] = useState([]);
    const [availableTherapists, setAvailableTherapists] = useState([]);

    // ★ 2. แก้ไข useMemo ให้ถูกต้อง
    const isFormValid = useMemo(() => {
        const isEmailValid = customerEmail && customerEmail.includes('@');
        return (
            customerName.trim() !== '' && 
            isEmailValid && 
            customerPhone && 
            isPhoneValid && 
            selectedDurationId && 
            selectedTherapist && 
            selectedSlot && 
            !isSubmitting
        );
    }, [customerName, customerEmail, customerPhone, isPhoneValid, selectedDurationId, selectedTherapist, selectedSlot, isSubmitting]);
    
    useEffect(() => {
        if (isOpen) {
            // Reset form state when modal opens
            setCustomerName('');
            setCustomerEmail('');
            setCustomerPhone(undefined);
            setSelectedService('');
            setSelectedDurationId('');
            setSelectedTherapist('');
            setSelectedSlot('');
            setAvailableSlots([]);
            setIsPhoneValid(true);

            const fetchServices = async () => {
                try {
                    const res = await authFetch('/api/services');
                    const data = await res.json();
                    const grouped = data.reduce((acc, s) => { if (!acc[s.name]) acc[s.name] = []; acc[s.name].push(s); return acc; }, {});
                    setGroupedServices(grouped);
                } catch (e) { console.error(e); }
            };
            const fetchTherapists = async () => {
                try {
                    const res = await authFetch('/api/therapists');
                    const data = await res.json();
                    setAllTherapists(data);
                    setAvailableTherapists(data);
                } catch (e) { console.error(e); }
            };
            fetchServices();
            fetchTherapists();
        }
    }, [isOpen]);

    useEffect(() => {
    if (!selectedDate || allTherapists.length === 0) {
        setAvailableTherapists(allTherapists);
        return;
    }

    const selectedDay = dayjs(selectedDate).day();
    const filtered = allTherapists.filter(therapist => 
        therapist.work_days && therapist.work_days.includes(selectedDay)
    );
            setAvailableTherapists(filtered);
        setSelectedTherapist(''); // รีเซ็ตพนักงานที่เลือกไว้
    }, [selectedDate, allTherapists]);

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
                const response = await authFetch(url);
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
        if (!isFormValid) {
            alert("Please ensure all fields are filled correctly.");
            return;
        }
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
                            
                            <div className="form-group">
                                <label>Telefon</label>
                                <PhoneInput
                                    international
                                    defaultCountry="DE"
                                    value={customerPhone}
                                    onChange={(value) => {
                                        setCustomerPhone(value);
                                        setIsPhoneValid(value ? isValidPhoneNumber(value) : true);
                                    }}
                                    className={!isPhoneValid ? 'phone-input-error' : ''}
                                />
                                {!isPhoneValid && <p className="error-message-small"> * Bitte geben Sie eine gültige Telefonnummer ein.</p>}
                            </div>

                            <div className="form-group"><label>E-mail</label><input type="email" required value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} /></div>
                            <div className="form-group"><ServiceSelector groupedServices={groupedServices} selectedService={selectedService} onServiceChange={(e) => setSelectedService(e.target.value)} availableDurations={availableDurations} selectedDuration={selectedDurationId} onDurationChange={(e) => setSelectedDurationId(e.target.value)} /></div>
                            <div className="form-group"><TherapistSelector therapists={availableTherapists} selectedTherapist={selectedTherapist} onChange={(e) => setSelectedTherapist(e.target.value)} /></div>
                            <div className="form-group">
                                <label htmlFor="timeslot-select">Freizeit</label>
                                <select id="timeslot-select" value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)} required>
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