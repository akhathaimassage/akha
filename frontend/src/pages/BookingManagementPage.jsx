import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
// ★ เพิ่ม 2 บรรทัดนี้เพื่อให้แน่ใจว่าการจัดการเวลาถูกต้อง
import utc from 'dayjs/plugin/utc'; 
dayjs.extend(utc);

import './Admin.css';
import { authFetch } from '../api/authFetch';
import useDebounce from '../hooks/useDebounce';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import AdminBookingModal from '../components/AdminBookingModal';
import AdminEditBookingModal from '../components/AdminEditBookingModal';

function BookingManagementPage() {
    const [bookings, setBookings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [therapistFilter, setTherapistFilter] = useState('');
    const [timeFilter, setTimeFilter] = useState('all');
    const [selectedYear, setSelectedYear] = useState('all');
    const [selectedMonth, setSelectedMonth] = useState('all');
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [editingBooking, setEditingBooking] = useState(null);

    const debouncedTherapistFilter = useDebounce(therapistFilter, 500);

    const years = useMemo(() => {
        const currentYear = dayjs().year();
        const startYear = 2024;
        const endYear = currentYear + 2;
        const list = [];
        for (let y = startYear; y <= endYear; y++) {
            list.push(y);
        }
        return list;
    }, []);

    const months = [
        { value: 1, label: 'January (Januar)' },
        { value: 2, label: 'February (Februar)' },
        { value: 3, label: 'March (März)' },
        { value: 4, label: 'April (April)' },
        { value: 5, label: 'May (Mai)' },
        { value: 6, label: 'June (Juni)' },
        { value: 7, label: 'July (Juli)' },
        { value: 8, label: 'August (August)' },
        { value: 9, label: 'September (September)' },
        { value: 10, label: 'October (Oktober)' },
        { value: 11, label: 'November (November)' },
        { value: 12, label: 'December (Dezember)' }
    ];

    const fetchBookings = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (debouncedTherapistFilter) {
                params.append('therapistName', debouncedTherapistFilter);
            }
            if (timeFilter !== 'all') {
                params.append('timeFilter', timeFilter);
            }
            if (selectedYear !== 'all') {
                params.append('year', selectedYear);
            }
            if (selectedMonth !== 'all') {
                params.append('month', selectedMonth);
            }
            
            const response = await authFetch(`/api/bookings/all?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setBookings(data);
        } catch (error) {
            console.error("Failed to fetch bookings:", error);
            setBookings([]);
        } finally {
            setIsLoading(false);
        }
    }, [debouncedTherapistFilter, timeFilter, selectedYear, selectedMonth]);

    useEffect(() => {
        fetchBookings();
    }, [fetchBookings]);

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this booking?')) {
            try {
                await authFetch(`/api/bookings/${id}`, { method: 'DELETE' });
                fetchBookings();
            } catch (error) {
                console.error("Failed to delete booking:", error);
            }
        }
    };

    const handleSaveBooking = () => {
        setIsBookingModalOpen(false);
        fetchBookings();
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text('Booking Report', 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Report generated on: ${dayjs().format('DD MMM YY, HH:mm')}`, 14, 29);

        autoTable(doc, {
            startY: 35,
            head: [['Date & Time', 'Customer', 'Phone', 'Service', 'Therapist', 'Status']],
            body: bookings.map(b => [
                // ★ แก้ไขตรงนี้เพื่อความแน่นอน 100%
                dayjs.utc(b.start_datetime).format('DD MMM, HH:mm'),
                b.customer_name || 'N/A',
                b.phone_number || 'N/A',
                b.service_name || 'N/A',
                b.therapist_name || 'N/A',
                b.status || 'N/A'
            ]),
            headStyles: { fillColor: [34, 139, 34] }
        });
        doc.save('booking-report.pdf');
    };

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Booking Management</h1>
                <button className="btn btn-add" onClick={() => setIsBookingModalOpen(true)}>
                    + Add New Booking
                </button>
            </div>

            <div className="admin-card filter-controls">
                <input 
                    type="text"
                    placeholder="Search by therapist name..."
                    className="admin-form-input"
                    value={therapistFilter}
                    onChange={(e) => setTherapistFilter(e.target.value)}
                />
                <select 
                    className="admin-form-input"
                    value={timeFilter}
                    onChange={(e) => setTimeFilter(e.target.value)}
                >
                    <option value="all">All Bookings</option>
                    <option value="upcoming">Upcoming & Present</option>
                    <option value="past">Past</option>
                </select>
                <select 
                    className="admin-form-input"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                >
                    <option value="all">All Years</option>
                    {years.map(y => (
                        <option key={y} value={y}>{y}</option>
                    ))}
                </select>
                <select 
                    className="admin-form-input"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                >
                    <option value="all">All Months</option>
                    {months.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                </select>
                <button 
                    className="btn" 
                    style={{backgroundColor: '#007bff', color: 'white'}} 
                    onClick={handleExportPDF}
                >
                    Export PDF
                </button>
            </div>
            <div className="admin-card">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Date & Time</th>
                            <th>Customer Info</th>
                            <th>Service</th>
                            <th>Therapist</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center' }}>Searching...</td>
                            </tr>
                        ) : bookings.length > 0 ? (
                            bookings.map(booking => (
                                <tr key={booking.id}>
                                    <td data-label="Date & Time">{dayjs.utc(booking.start_datetime).format('DD MMM YY, HH:mm')}</td>
                                    <td data-label="Customer Info">
                                        <div className="customer-details">
                                            <div style={{ fontWeight: 'bold' }}>{booking.customer_name}</div>
                                            <div>{booking.phone_number}</div>
                                            <div>{booking.email}</div>
                                        </div>
                                    </td>
                                    <td data-label="Service">{booking.service_name}</td>
                                    <td data-label="Therapist">{booking.therapist_name}</td>
                                    <td data-label="Status">{booking.status}</td>
                                    <td data-label="Actions">
                                        <button className="btn" style={{backgroundColor: '#ffc107', color: 'black', marginRight: '8px'}} onClick={() => setEditingBooking(booking)}>Edit</button>
                                        <button className="btn btn-delete" onClick={() => handleDelete(booking.id)}>Delete</button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center' }}>No bookings found for the selected filter.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isBookingModalOpen && (
                <AdminBookingModal 
                    isOpen={isBookingModalOpen}
                    onClose={() => setIsBookingModalOpen(false)}
                    onSave={handleSaveBooking}
                />
            )}

            {editingBooking && (
                <AdminEditBookingModal 
                    isOpen={!!editingBooking}
                    booking={editingBooking}
                    onClose={() => setEditingBooking(null)}
                    onSave={() => {
                        setEditingBooking(null);
                        fetchBookings();
                    }}
                />
            )}
        </div>
    );
}

export default BookingManagementPage;