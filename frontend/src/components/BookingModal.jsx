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

    const [bookingSuccessData, setBookingSuccessData] = useState(null);

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
    
    const handleClose = () => {
        setBookingSuccessData(null);
        onClose();
    };

    useEffect(() => {
        if (isOpen) {
            // Reset form state when modal opens
            setBookingSuccessData(null);
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
            
            const serviceObj = availableDurations.find(d => String(d.id) === String(selectedDurationId));
            const therapistObj = allTherapists.find(t => String(t.id) === String(selectedTherapist));

            setBookingSuccessData({
                customerName,
                customerEmail,
                customerPhone,
                serviceName: selectedService,
                durationMinutes: serviceObj?.duration_minutes,
                therapistName: therapistObj?.full_name || 'Therapeut',
                date: dayjs(selectedDate).format('DD.MM.YYYY'),
                time: selectedSlot
            });
        } catch (error) {
            alert(`Booking failed: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (!isOpen) return null;

    if (bookingSuccessData) {
        return (
            <div className="booking-modal-overlay" onClick={handleClose}>
                <div className="booking-modal-card booking-success-card" onClick={e => e.stopPropagation()}>
                    <button className="close-button" type="button" onClick={handleClose}>&times;</button>
                    
                    <div className="success-header">
                        <div className="success-icon-badge">✓</div>
                        <h2>Vielen Dank, {bookingSuccessData.customerName}!</h2>
                        <p className="success-subtitle">Ihre Buchung war erfolgreich</p>
                    </div>

                    <div className="success-card-body">
                        <div className="success-details-box">
                            <div className="success-detail-row">
                                <span className="detail-label">Behandlung:</span>
                                <span className="detail-value">{bookingSuccessData.serviceName} ({bookingSuccessData.durationMinutes} Min.)</span>
                            </div>
                            <div className="success-detail-row">
                                <span className="detail-label">Masseurin:</span>
                                <span className="detail-value">{bookingSuccessData.therapistName}</span>
                            </div>
                            <div className="success-detail-row highlight-row">
                                <span className="detail-label">Datum & Uhrzeit:</span>
                                <span className="detail-value highlight-value">{bookingSuccessData.date} um {bookingSuccessData.time} Uhr</span>
                            </div>
                        </div>

                        <div className="success-notice-box">
                            <div className="notice-icon">📧</div>
                            <div className="notice-text">
                                <strong>Bestätigungs-E-Mail gesendet</strong>
                                <p>Wir haben eine Bestätigungs-E-Mail an <u>{bookingSuccessData.customerEmail}</u> gesendet.</p>
                                <p className="spam-hint">
                                    💡 <em>Falls Sie keine E-Mail in Ihrem Posteingang finden, überprüfen Sie bitte auch Ihren <strong>Spam- / Junk-Ordner</strong>.</em>
                                </p>
                            </div>
                        </div>

                        <div className="success-contact-box">
                            <p className="location-text">📍 <strong>Akha Thai Massage: Hauptstraße 31, 79761 Tiengen</strong></p>
                            <p className="contact-text">Fragen oder Änderungen? Tel: <strong>+49 (0) 7741 9695546</strong> / WhatsApp <strong>+49 151 51 646 555</strong></p>
                        </div>

                        <button type="button" className="success-done-btn" onClick={handleClose}>
                            Schließen / Fertig
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="booking-modal-overlay" onClick={handleClose}>
            <div className="booking-modal-card" onClick={e => e.stopPropagation()}>
                <div className="card-header-image">
                    <img src="/images/akha-logo.png" alt="Logo" className="logo" />
                    <button className="close-button" type="button" onClick={handleClose}>&times;</button>
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