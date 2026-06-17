import React, { useState, useEffect, useMemo } from 'react';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './BookingModal.css';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { authFetch } from '../api/authFetch';

dayjs.extend(utc);

// Generate standard 30-minute time intervals from 08:00 to 22:00
const generateTimeSlots = () => {
    const slots = [];
    let start = dayjs().hour(8).minute(0);
    const end = dayjs().hour(22).minute(0);
    while (start.isBefore(end) || start.isSame(end)) {
        slots.push(start.format('HH:mm'));
        start = start.add(30, 'minute');
    }
    return slots;
};

const TIME_SLOTS = generateTimeSlots();

function AdminEditBookingModal({ isOpen, onClose, onSave, booking }) {
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [selectedServiceId, setSelectedServiceId] = useState('');
    const [selectedTherapistId, setSelectedTherapistId] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [selectedTime, setSelectedTime] = useState('09:00');
    const [status, setStatus] = useState('confirmed');
    const [priceAtBooking, setPriceAtBooking] = useState('');
    
    const [services, setServices] = useState([]);
    const [therapists, setTherapists] = useState([]);
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPhoneValid, setIsPhoneValid] = useState(true);

    const isFormValid = useMemo(() => {
        return (
            customerName.trim() !== '' &&
            customerPhone &&
            isPhoneValid &&
            selectedServiceId &&
            selectedTherapistId &&
            selectedTime &&
            priceAtBooking !== '' &&
            !isSubmitting
        );
    }, [customerName, customerPhone, isPhoneValid, selectedServiceId, selectedTherapistId, selectedTime, priceAtBooking, isSubmitting]);

    // Fetch lists when modal is opened
    useEffect(() => {
        if (isOpen && booking) {
            // Set initial state from the booking object
            setCustomerName(booking.customer_name || '');
            setCustomerPhone(booking.phone_number || '');
            setCustomerEmail(booking.email || '');
            setSelectedServiceId(booking.service_id || '');
            setSelectedTherapistId(booking.therapist_id || '');
            setStatus(booking.status || 'confirmed');
            setPriceAtBooking(booking.price_at_booking !== undefined ? booking.price_at_booking : '');
            
            // Handle UTC/Local date conversions
            if (booking.start_datetime) {
                const parsedDate = dayjs.utc(booking.start_datetime);
                setSelectedDate(parsedDate.toDate());
                setSelectedTime(parsedDate.format('HH:mm'));
            } else {
                setSelectedDate(new Date());
                setSelectedTime('09:00');
            }

            setIsPhoneValid(true);

            // Fetch all services and therapists for dropdowns
            const fetchData = async () => {
                try {
                    const [servicesRes, therapistsRes] = await Promise.all([
                        authFetch('/api/services/all'),
                        authFetch('/api/therapists/all')
                    ]);
                    if (servicesRes.ok && therapistsRes.ok) {
                        const servicesData = await servicesRes.json();
                        const therapistsData = await therapistsRes.json();
                        setServices(servicesData);
                        setTherapists(therapistsData);
                    }
                } catch (error) {
                    console.error("Failed to load options for editing booking:", error);
                }
            };
            fetchData();
        }
    }, [isOpen, booking]);

    // Auto-update price when service changes (if user hasn't overridden it yet or when service changes)
    const handleServiceChange = (e) => {
        const servId = e.target.value;
        setSelectedServiceId(servId);
        const match = services.find(s => String(s.id) === String(servId));
        if (match) {
            setPriceAtBooking(match.discounted_price !== null ? match.discounted_price : match.price);
        }
    };

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        if (!isFormValid) {
            alert("Please fill in all fields correctly.");
            return;
        }
        setIsSubmitting(true);

        const dateStr = dayjs(selectedDate).format('YYYY-MM-DD');
        const start_datetime = `${dateStr} ${selectedTime}:00`;

        const payload = {
            serviceId: parseInt(selectedServiceId, 10),
            therapistId: parseInt(selectedTherapistId, 10),
            start_datetime,
            status,
            price_at_booking: parseFloat(priceAtBooking),
            customerName,
            customerPhone,
            customerEmail: customerEmail.trim() === '' ? null : customerEmail
        };

        try {
            const response = await authFetch(`/api/bookings/${booking.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Failed to update booking.');
            }

            alert('Booking updated successfully!');
            onSave();
        } catch (error) {
            alert(`Error: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !booking) return null;

    return (
        <div className="booking-modal-overlay" onClick={onClose}>
            <div className="booking-modal-card" onClick={e => e.stopPropagation()}>
                <div className="card-header-image">
                    <button className="close-button" type="button" onClick={onClose}>&times;</button>
                    <header className="form-header">
                        <h1>Edit Booking</h1>
                        <span className="subtitle">ID: #{booking.id}</span>
                    </header>
                </div>
                <div className="card-body">
                    <form className="booking-form" onSubmit={handleFormSubmit}>
                        <div className="form-column">
                            <div className="form-group">
                                <label>Customer Name</label>
                                <input 
                                    type="text" 
                                    required 
                                    value={customerName} 
                                    onChange={e => setCustomerName(e.target.value)} 
                                />
                            </div>
                            
                            <div className="form-group">
                                <label>Customer Phone</label>
                                <PhoneInput
                                    international
                                    defaultCountry="DE"
                                    required
                                    value={customerPhone}
                                    onChange={(value) => {
                                        setCustomerPhone(value);
                                        setIsPhoneValid(value ? isValidPhoneNumber(value) : true);
                                    }}
                                    className={!isPhoneValid ? 'phone-input-error' : ''}
                                />
                                {!isPhoneValid && <p className="error-message-small"> * Bitte geben Sie eine gültige Telefonnummer ein.</p>}
                            </div>

                            <div className="form-group">
                                <label>E-mail (Optional)</label>
                                <input 
                                    type="email" 
                                    value={customerEmail} 
                                    onChange={e => setCustomerEmail(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label>Service</label>
                                <select 
                                    value={selectedServiceId} 
                                    onChange={handleServiceChange}
                                    required
                                >
                                    <option value="">-- Select Service --</option>
                                    {services.map(s => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} ({s.duration_minutes} min) - €{s.discounted_price !== null ? `${s.discounted_price} (Promo)` : s.price}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-column">
                            <div className="form-group">
                                <label>Therapist</label>
                                <select 
                                    value={selectedTherapistId} 
                                    onChange={e => setSelectedTherapistId(e.target.value)}
                                    required
                                >
                                    <option value="">-- Select Therapist --</option>
                                    {therapists.map(t => (
                                        <option key={t.id} value={t.id}>
                                            {t.full_name} {t.is_active ? '' : '(Inactive)'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Date</label>
                                <DatePicker 
                                    selected={selectedDate} 
                                    onChange={(date) => setSelectedDate(date)} 
                                    dateFormat="yyyy-MM-dd"
                                    required
                                    className="admin-form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label>Time Slot</label>
                                <select 
                                    value={selectedTime} 
                                    onChange={(e) => setSelectedTime(e.target.value)}
                                    required
                                >
                                    {TIME_SLOTS.map(slot => (
                                        <option key={slot} value={slot}>{slot}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Price (€)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    required 
                                    value={priceAtBooking} 
                                    onChange={e => setPriceAtBooking(e.target.value)} 
                                />
                            </div>

                            <div className="form-group">
                                <label>Status</label>
                                <select 
                                    value={status} 
                                    onChange={e => setStatus(e.target.value)}
                                    required
                                >
                                    <option value="confirmed">Confirmed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>

                            <button type="submit" className="submit-button" style={{ width: '100%' }} disabled={!isFormValid}>
                               {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default AdminEditBookingModal;
