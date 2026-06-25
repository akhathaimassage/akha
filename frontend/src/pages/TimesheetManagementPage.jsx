import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import './Admin.css';
import { authFetch } from '../api/authFetch';

function TimesheetManagementPage() {
    const [therapists, setTherapists] = useState([]);
    const [selectedTherapistId, setSelectedTherapistId] = useState('');
    const [selectedYear, setSelectedYear] = useState(dayjs().year());
    const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1); // 1-12
    const [timesheetRecords, setTimesheetRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // State for local editing of the days of the month
    const [daysData, setDaysData] = useState([]);

    // State for Bulk Generation form
    const [showBulkGen, setShowBulkGen] = useState(false);
    const [bulkStart, setBulkStart] = useState('09:00');
    const [bulkEnd, setBulkEnd] = useState('18:00');
    const [bulkBreak, setBulkBreak] = useState(60);
    const [bulkNotes, setBulkNotes] = useState('Reguläre Schicht');
    const [bulkOverwrite, setBulkOverwrite] = useState(false);
    const [bulkDays, setBulkDays] = useState({
        1: true, // Monday
        2: true, // Tuesday
        3: true, // Wednesday
        4: true, // Thursday
        5: true, // Friday
        6: false, // Saturday
        0: false  // Sunday
    });

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
        { value: 1, label: 'Januar' },
        { value: 2, label: 'Februar' },
        { value: 3, label: 'März' },
        { value: 4, label: 'April' },
        { value: 5, label: 'Mai' },
        { value: 6, label: 'Juni' },
        { value: 7, label: 'Juli' },
        { value: 8, label: 'August' },
        { value: 9, label: 'September' },
        { value: 10, label: 'Oktober' },
        { value: 11, label: 'November' },
        { value: 12, label: 'Dezember' }
    ];

    const germanDays = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

    // Fetch therapists who need timesheets
    const fetchTherapists = useCallback(async () => {
        try {
            const response = await authFetch('/api/therapists/all');
            const data = await response.json();
            // Filter to only official/Angestellte therapists
            const filtered = data.filter(t => t.require_timesheet === true);
            setTherapists(filtered);
            if (filtered.length > 0) {
                setSelectedTherapistId(filtered[0].id.toString());
            }
        } catch (error) {
            console.error("Failed to fetch therapists for timesheets:", error);
        }
    }, []);

    useEffect(() => {
        fetchTherapists();
    }, [fetchTherapists]);

    // Fetch timesheet records for selected therapist & period
    const fetchTimesheetRecords = useCallback(async () => {
        if (!selectedTherapistId) return;
        setIsLoading(true);
        try {
            const response = await authFetch(`/api/admin/timesheets?therapistId=${selectedTherapistId}&year=${selectedYear}&month=${selectedMonth}`);
            if (!response.ok) throw new Error("Failed to fetch timesheet");
            const data = await response.json();
            setTimesheetRecords(data);
        } catch (error) {
            console.error("Error fetching timesheets:", error);
            setTimesheetRecords([]);
        } finally {
            setIsLoading(false);
        }
    }, [selectedTherapistId, selectedYear, selectedMonth]);

    useEffect(() => {
        fetchTimesheetRecords();
    }, [fetchTimesheetRecords]);

    // Generate list of days in the month and map existing DB records
    useEffect(() => {
        if (!selectedYear || !selectedMonth) return;

        const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const daysInMonth = dayjs(dateStr).daysInMonth();
        const generatedDays = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const currentDayDate = dayjs(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
            const dateFormatted = currentDayDate.format('YYYY-MM-DD');
            const dayOfWeek = currentDayDate.day(); // 0 = Sunday, 1 = Monday, etc.

            // Find matching DB record if it exists
            const record = timesheetRecords.find(r => r.work_date_str === dateFormatted);

            generatedDays.push({
                dateStr: dateFormatted,
                dayNum: d,
                dayOfWeekName: germanDays[dayOfWeek],
                dayOfWeekNum: dayOfWeek,
                recordId: record ? record.id : null,
                start_time: record && record.start_time_str ? record.start_time_str.slice(0, 5) : '',
                end_time: record && record.end_time_str ? record.end_time_str.slice(0, 5) : '',
                break_minutes: record ? record.break_minutes : 0,
                notes: record ? record.notes || '' : '',
                isSaved: !!record,
                hasChanges: false
            });
        }

        setDaysData(generatedDays);
    }, [selectedYear, selectedMonth, timesheetRecords]);

    const activeTherapist = useMemo(() => {
        return therapists.find(t => t.id.toString() === selectedTherapistId);
    }, [therapists, selectedTherapistId]);

    // Check if there are unsaved local modifications in any cell
    const hasUnsavedChanges = useMemo(() => {
        return daysData.some(d => d.hasChanges);
    }, [daysData]);

    // Calculate worked hours details for a row
    const calculateHours = (start, end, breakMin) => {
        if (!start || !end) return 0;
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        
        let startMinutes = startH * 60 + startM;
        let endMinutes = endH * 60 + endM;
        
        // If end time is before start time, assume it spans to next day (unlikely for normal shift, but supported)
        if (endMinutes < startMinutes) {
            endMinutes += 24 * 60;
        }

        const totalMinutes = endMinutes - startMinutes - (parseInt(breakMin, 10) || 0);
        return Math.max(0, totalMinutes / 60);
    };

    // German labor law ArbZG check
    const checkCompliance = (start, end, breakMin) => {
        if (!start || !end) return { ok: true };
        const workedHours = calculateHours(start, end, breakMin);
        const breakVal = parseInt(breakMin, 10) || 0;
        const warnings = [];

        // Daily maximum hours check (ArbZG § 3: max 8 hours standard, max 10 hours under exception)
        if (workedHours > 10) {
            warnings.push("Über 10 Std. (ArbZG §3 Limit: max. 10 Std.)");
        } else if (workedHours > 8) {
            warnings.push("Über 8 Std. (ArbZG §3 Standard: 8 Std.)");
        }

        // Rest breaks check (ArbZG § 4: >6 to 9 hours requires 30 min break, >9 hours requires 45 min break)
        const totalDutyMins = (calculateHours(start, end, 0) * 60);
        if (totalDutyMins > 9 * 60 && breakVal < 45) {
            warnings.push("Arbeitszeit >9 Std. erfordert min. 45 Min. Pause (ArbZG §4)");
        } else if (totalDutyMins > 6 * 60 && breakVal < 30) {
            warnings.push("Arbeitszeit >6 Std. erfordert min. 30 Min. Pause (ArbZG §4)");
        }

        return {
            ok: warnings.length === 0,
            warnings
        };
    };

    // Total monthly stats
    const monthlyStats = useMemo(() => {
        let totalHours = 0;
        let totalBreaks = 0;
        let workDaysCount = 0;

        daysData.forEach(day => {
            if (day.start_time && day.end_time) {
                totalHours += calculateHours(day.start_time, day.end_time, day.break_minutes);
                totalBreaks += parseInt(day.break_minutes, 10) || 0;
                workDaysCount++;
            }
        });

        return {
            totalHours: parseFloat(totalHours.toFixed(2)),
            totalBreaks,
            workDaysCount
        };
    }, [daysData]);

    // Handle change of cell input value locally
    const handleCellChange = (dateStr, field, value) => {
        setDaysData(prev => prev.map(day => {
            if (day.dateStr === dateStr) {
                return {
                    ...day,
                    [field]: value,
                    hasChanges: true
                };
            }
            return day;
        }));
    };

    // Save individual day timesheet
    const handleSaveDay = async (day) => {
        if (!day.start_time || !day.end_time) {
            alert("Bitte geben Sie sowohl Beginn als auch Ende an.");
            return;
        }

        const compliance = checkCompliance(day.start_time, day.end_time, day.break_minutes);
        if (!compliance.ok) {
            const warningMsg = `Achtung (Warnung gemäß ArbZG §4):\n` +
                compliance.warnings.map(w => `- ${w}`).join('\n') +
                `\n\nMöchten Sie diesen Eintrag dennoch speichern?`;
            if (!window.confirm(warningMsg)) {
                return;
            }
        }

        try {
            const response = await authFetch('/api/admin/timesheets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    therapistId: parseInt(selectedTherapistId, 10),
                    work_date: day.dateStr,
                    start_time: day.start_time,
                    end_time: day.end_time,
                    break_minutes: parseInt(day.break_minutes, 10) || 0,
                    notes: day.notes
                })
            });

            if (!response.ok) throw new Error("Fehler beim Speichern des Eintrags.");
            
            // Refresh to get clean state
            fetchTimesheetRecords();
            alert(`Arbeitszeit für ${day.dateStr} erfolgreich gespeichert.`);
        } catch (error) {
            console.error("Save error:", error);
            alert("Eintrag konnte nicht gespeichert werden.");
        }
    };

    // Save all unsaved changes bulk
    const handleSaveAllChanges = async () => {
        const changedDays = daysData.filter(d => d.hasChanges && d.start_time && d.end_time);
        if (changedDays.length === 0) return;

        // Check if any changed days violate compliance
        const nonCompliantDays = changedDays.filter(d => !checkCompliance(d.start_time, d.end_time, d.break_minutes).ok);
        if (nonCompliantDays.length > 0) {
            const warningMsg = `Achtung: Einige Tage verstoßen gegen das Arbeitszeitgesetz (ArbZG §4):\n` +
                nonCompliantDays.map(d => `- Datum ${d.dayNum}.${selectedMonth}.${selectedYear}: ${checkCompliance(d.start_time, d.end_time, d.break_minutes).warnings.join(', ')}`).join('\n') +
                `\n\nMöchten Sie alle Änderungen dennoch speichern?`;
            if (!window.confirm(warningMsg)) {
                return;
            }
        }

        if (window.confirm(`${changedDays.length} geänderte Tage speichern?`)) {
            setIsLoading(true);
            try {
                const bulkPayload = changedDays.map(d => ({
                    work_date: d.dateStr,
                    start_time: d.start_time,
                    end_time: d.end_time,
                    break_minutes: parseInt(d.break_minutes, 10) || 0,
                    notes: d.notes
                }));

                const response = await authFetch('/api/admin/timesheets/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        therapistId: parseInt(selectedTherapistId, 10),
                        timesheets: bulkPayload
                    })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "Failed to save changes");

                alert(`Erfolgreich ${changedDays.length} Einträge gespeichert.`);
                fetchTimesheetRecords();
            } catch (error) {
                console.error("Bulk save changes error:", error);
                alert(`Fehler beim Speichern der Änderungen: ${error.message}`);
            } finally {
                setIsLoading(false);
            }
        }
    };

    // Import from Booking Calendar (นวดตามคิว)
    const handleImportFromBookings = async () => {
        if (!selectedTherapistId || !activeTherapist) return;
        
        setIsLoading(true);
        try {
            // Fetch all bookings for this therapist in current period
            const response = await authFetch(`/api/bookings/all?therapistName=${encodeURIComponent(activeTherapist.full_name)}&year=${selectedYear}&month=${selectedMonth}`);
            if (!response.ok) throw new Error("Failed to fetch bookings");
            const allBookings = await response.json();
            
            // Ensure strict matching on therapist ID and confirmed status
            const therapistBookings = allBookings.filter(b => 
                b.therapist_id === activeTherapist.id && 
                b.status === 'confirmed'
            );

            if (therapistBookings.length === 0) {
                alert("Keine Buchungen für diesen Mitarbeiter in diesem Zeitraum gefunden.");
                setIsLoading(false);
                return;
            }

            // Group bookings by date
            const bookingsByDate = {};
            therapistBookings.forEach(b => {
                const dateStr = dayjs(b.start_datetime).format('YYYY-MM-DD');
                if (!bookingsByDate[dateStr]) {
                    bookingsByDate[dateStr] = [];
                }
                bookingsByDate[dateStr].push(b);
            });

            let updatedDaysCount = 0;

            // Generate daily updates from bookings
            setDaysData(prev => prev.map(day => {
                const dayBookings = bookingsByDate[day.dateStr];
                if (dayBookings && dayBookings.length > 0) {
                    // Sort bookings chronologically
                    dayBookings.sort((a, b) => dayjs(a.start_datetime).diff(dayjs(b.start_datetime)));

                    const firstBooking = dayBookings[0];
                    const lastBooking = dayBookings[dayBookings.length - 1];

                    const start = dayjs(firstBooking.start_datetime);
                    const end = dayjs(lastBooking.end_datetime);

                    const startTimeStr = start.format('HH:mm');
                    const endTimeStr = end.format('HH:mm');

                    // Total elapsed minutes (Start of first booking to end of last booking)
                    const totalDutyMinutes = end.diff(start, 'minute');

                    // Active massage minutes
                    let totalBookingMinutes = 0;
                    dayBookings.forEach(b => {
                        const bStart = dayjs(b.start_datetime);
                        const bEnd = dayjs(b.end_datetime);
                        totalBookingMinutes += bEnd.diff(bStart, 'minute');
                    });

                    // Pause is the gap between bookings
                    const pauseMinutes = Math.max(0, totalDutyMinutes - totalBookingMinutes);

                    updatedDaysCount++;

                    return {
                        ...day,
                        start_time: startTimeStr,
                        end_time: endTimeStr,
                        break_minutes: pauseMinutes,
                        notes: 'Aus Buchungskalender importiert',
                        hasChanges: true
                    };
                }
                return day;
            }));

            alert(`Erfolgreich Arbeitszeiten aus ${updatedDaysCount} Tagen mit Buchungen geladen.\nBitte überprüfen Sie die Einträge und klicken Sie auf 'Änderungen speichern', um die Daten dauerhaft zu sichern.`);
        } catch (error) {
            console.error("Import bookings error:", error);
            alert("Fehler beim Importieren der Buchungsdaten.");
        } finally {
            setIsLoading(false);
        }
    };

    // Clear / Delete individual day timesheet
    const handleClearDay = async (day) => {
        if (!day.recordId) {
            // Just clear local state
            setDaysData(prev => prev.map(d => {
                if (d.dateStr === day.dateStr) {
                    return {
                        ...d,
                        start_time: '',
                        end_time: '',
                        break_minutes: 0,
                        notes: '',
                        hasChanges: false
                    };
                }
                return d;
            }));
            return;
        }

        if (window.confirm(`Sind Sie sicher, dass Sie den Eintrag für ${day.dateStr} löschen möchten?`)) {
            try {
                const response = await authFetch(`/api/admin/timesheets/${day.recordId}`, {
                    method: 'DELETE'
                });
                if (!response.ok) throw new Error("Fehler beim Löschen des Eintrags.");
                fetchTimesheetRecords();
                alert(`Eintrag für ${day.dateStr} gelöscht.`);
            } catch (error) {
                console.error("Delete error:", error);
                alert("Eintrag konnte nicht gelöscht werden.");
            }
        }
    };

    // Bulk Generate & Save to DB
    const handleBulkGenerate = async (e) => {
        e.preventDefault();
        
        if (!selectedTherapistId) return;

        const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
        const daysInMonth = dayjs(dateStr).daysInMonth();
        const bulkPayload = [];

        for (let d = 1; d <= daysInMonth; d++) {
            const currentDayDate = dayjs(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
            const dateFormatted = currentDayDate.format('YYYY-MM-DD');
            const dayOfWeek = currentDayDate.day(); // 0 = Sunday, 1 = Monday, etc.

            // Only generate for checked weekdays
            if (bulkDays[dayOfWeek]) {
                const existing = timesheetRecords.find(r => r.work_date_str === dateFormatted);
                
                // If overwrite is false, skip already saved records
                if (!existing || bulkOverwrite) {
                    bulkPayload.push({
                        work_date: dateFormatted,
                        start_time: bulkStart,
                        end_time: bulkEnd,
                        break_minutes: parseInt(bulkBreak, 10) || 0,
                        notes: bulkNotes
                    });
                }
            }
        }

        if (bulkPayload.length === 0) {
            alert("Keine passenden Tage zum Ausfüllen gefunden. Wochentage prüfen oder 'Einträge überschreiben' aktivieren.");
            return;
        }

        if (window.confirm(`Standardarbeitszeiten (${bulkStart}-${bulkEnd}, Pause: ${bulkBreak} Min.) für ${bulkPayload.length} Tage generieren?`)) {
            try {
                const response = await authFetch('/api/admin/timesheets/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        therapistId: parseInt(selectedTherapistId, 10),
                        timesheets: bulkPayload
                    })
                });

                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "Bulk generate failed");

                alert(`Erfolgreich ${bulkPayload.length} Einträge gespeichert.`);
                fetchTimesheetRecords();
                setShowBulkGen(false);
            } catch (error) {
                console.error("Bulk generate error:", error);
                alert(`Fehler bei der automatischen Generierung: ${error.message}`);
            }
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="timesheet-container">
            {/* Inline Printable Stylesheet wrapper */}
            <style>{`
                @media print {
                    /* Hide components that are not needed in tax audit printouts */
                    .sidebar, .sidebar-nav, .sidebar-header, .sidebar-footer,
                    header, .modal-overlay, .admin-card:first-of-type,
                    .filter-controls, .bulk-gen-section, .btn, .actions, th:last-child, td:last-child {
                        display: none !important;
                    }
                    
                    /* Expand page margins & width for print */
                    body, html, #root, .admin-layout, .admin-content, .timesheet-container {
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff !important;
                        color: #000 !important;
                    }
                    
                    .admin-card {
                        box-shadow: none !important;
                        border: none !important;
                        padding: 0 !important;
                        margin-bottom: 0 !important;
                        background: #fff !important;
                    }
                    
                    /* Print Header and Branding */
                    .print-header {
                        display: block !important;
                        margin-bottom: 20px;
                        border-bottom: 2px solid #333;
                        padding-bottom: 10px;
                    }
                    
                    /* Make table render standard high contrast border style */
                    .admin-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }
                    .admin-table th, .admin-table td {
                        border: 1px solid #444 !important;
                        padding: 6px 10px !important;
                        font-size: 11px !important;
                        color: #000 !important;
                    }
                    .admin-table th {
                        background-color: #f0f0f0 !important;
                        color: #000 !important;
                        font-weight: bold !important;
                    }
                    .admin-table tr {
                        background-color: transparent !important;
                    }
                    
                    /* Style form inputs to look like static read-only text fields */
                    .timesheet-input {
                        border: none !important;
                        background: transparent !important;
                        padding: 0 !important;
                        font-size: 11px !important;
                        color: #000 !important;
                        width: auto !important;
                        text-align: center !important;
                        -webkit-appearance: none;
                        -moz-appearance: none;
                        appearance: none;
                    }
                    input[type="time"]::-webkit-calendar-picker-indicator,
                    input[type="number"]::-webkit-inner-spin-button {
                        display: none !important;
                    }
                    
                    /* Signature space at bottom of document */
                    .print-signatures {
                        display: flex !important;
                        justify-content: space-between;
                        margin-top: 40px;
                        font-size: 12px;
                    }
                    .signature-line {
                        width: 45%;
                        border-top: 1px solid #000;
                        text-align: center;
                        margin-top: 50px;
                        padding-top: 5px;
                    }
                }
                
                /* Screen style overrides */
                .print-header {
                    display: none;
                }
                .print-signatures {
                    display: none;
                }
                .timesheet-input {
                    width: 100%;
                    padding: 6px;
                    border: 1px solid var(--border-color);
                    border-radius: 4px;
                    font-size: 0.9em;
                }
                .timesheet-input:focus {
                    outline: none;
                    border-color: var(--primary-green);
                }
                .compliance-warn {
                    display: inline-block;
                    margin-top: 4px;
                    font-size: 0.8rem;
                    color: var(--danger-color);
                    font-weight: 500;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-bottom: 20px;
                }
                .stat-box {
                    background: #f8f9fa;
                    border: 1px solid var(--border-color);
                    padding: 15px;
                    border-radius: 6px;
                    text-align: center;
                }
                .stat-value {
                    font-size: 1.5rem;
                    font-weight: bold;
                    color: var(--primary-green);
                }
                .bulk-gen-section {
                    background: #f8f9fa;
                    border: 1px solid var(--border-color);
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                }
                .bulk-days-grid {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px;
                    margin: 10px 0;
                }
                .bulk-day-label {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    cursor: pointer;
                    font-weight: normal;
                }
            `}</style>

            {/* Print Only Title Section */}
            <div className="print-header">
                <div style={{ float: 'right', textAlign: 'right' }}>
                    <strong>Akha Thai Massage</strong><br />
                    Luitpoldstraße 27, 96052 Bamberg
                </div>
                <h2>Arbeitszeitnachweis (Zeiterfassung)</h2>
                <div style={{ marginTop: '10px' }}>
                    <strong>Mitarbeiter:</strong> {activeTherapist?.full_name || 'N/A'}<br />
                    <strong>Monat:</strong> {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h1>Zeiterfassung (Timesheets)</h1>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-edit" onClick={handlePrint} disabled={!selectedTherapistId}>
                        🖨️ Monatsbericht drucken
                    </button>
                </div>
            </div>

            {/* Filter controls */}
            <div className="admin-card">
                <h3>Mitarbeiter und Monat auswählen</h3>
                <div className="filter-controls">
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Mitarbeiter (Angestellte)</label>
                        {therapists.length === 0 ? (
                            <div style={{ color: 'red', fontSize: '0.9rem', marginTop: '10px' }}>
                                ⚠️ Keine Mitarbeiter für Zeiterfassung konfiguriert.<br />
                                Aktivieren Sie zuerst "Require Timesheet" im Mitarbeiterprofil.
                            </div>
                        ) : (
                            <select 
                                className="admin-form-input" 
                                value={selectedTherapistId} 
                                onChange={(e) => setSelectedTherapistId(e.target.value)}
                            >
                                {therapists.map(t => (
                                    <option key={t.id} value={t.id}>{t.full_name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div style={{ width: '120px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Jahr</label>
                        <select 
                            className="admin-form-input" 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                        >
                            {years.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ width: '220px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Monat</label>
                        <select 
                            className="admin-form-input" 
                            value={selectedMonth} 
                            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                        >
                            {months.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Main timesheet section */}
            {selectedTherapistId && (
                <div className="admin-card">
                    {/* Monthly Summary Statistics */}
                    <div className="stats-grid">
                        <div className="stat-box">
                            <div>Gesamte Arbeitstage</div>
                            <div className="stat-value">{monthlyStats.workDaysCount} Tage</div>
                        </div>
                        <div className="stat-box">
                            <div>Gesamte Arbeitsstunden</div>
                            <div className="stat-value">{monthlyStats.totalHours} Std.</div>
                        </div>
                        <div className="stat-box">
                            <div>Gesamte Pausenzeit</div>
                            <div className="stat-value">{monthlyStats.totalBreaks} Min.</div>
                        </div>
                    </div>

                    {/* Bulk Generation & Import Options */}
                    <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button 
                            className="btn btn-add" 
                            onClick={() => setShowBulkGen(!showBulkGen)}
                        >
                            {showBulkGen ? "Auto-Ausfüllen ausblenden" : "⚡ Standardarbeitszeiten automatisch ausfüllen"}
                        </button>
                        
                        <button 
                            className="btn" 
                            style={{ backgroundColor: '#28a745' }}
                            onClick={handleImportFromBookings}
                        >
                            📅 Aus Buchungskalender importieren
                        </button>

                        {hasUnsavedChanges && (
                            <button 
                                className="btn"
                                style={{ backgroundColor: '#007bff', fontWeight: 'bold' }}
                                onClick={handleSaveAllChanges}
                            >
                                Save All Changes / บันทึกการเปลี่ยนแปลงทั้งหมด
                            </button>
                        )}
                    </div>

                    {/* Bulk Generation Form */}
                    {showBulkGen && (
                        <div className="bulk-gen-section">
                            <h4>Parameter für automatisches Ausfüllen</h4>
                            <p style={{ fontSize: '0.85rem', color: '#666' }}>
                                Arbeitszeitdaten für bestimmte Wochentage des ausgewählten Monats automatisch generieren.
                            </p>
                            <form onSubmit={handleBulkGenerate} className="admin-form">
                                <div style={{ width: '120px' }}>
                                    <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.85rem' }}>Arbeitsbeginn</label>
                                    <input 
                                        type="time" 
                                        className="admin-form-input" 
                                        value={bulkStart} 
                                        onChange={(e) => setBulkStart(e.target.value)} 
                                        required 
                                    />
                                </div>
                                <div style={{ width: '120px' }}>
                                    <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.85rem' }}>Arbeitsende</label>
                                    <input 
                                        type="time" 
                                        className="admin-form-input" 
                                        value={bulkEnd} 
                                        onChange={(e) => setBulkEnd(e.target.value)} 
                                        required 
                                    />
                                </div>
                                <div style={{ width: '120px' }}>
                                    <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.85rem' }}>Pause (Minuten)</label>
                                    <input 
                                        type="number" 
                                        className="admin-form-input" 
                                        value={bulkBreak} 
                                        onChange={(e) => setBulkBreak(parseInt(e.target.value, 10) || 0)} 
                                        min="0"
                                        required 
                                    />
                                </div>
                                <div style={{ flex: 1, minWidth: '150px' }}>
                                    <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.85rem' }}>Bemerkungen</label>
                                    <input 
                                        type="text" 
                                        className="admin-form-input" 
                                        placeholder="Reguläre Schicht" 
                                        value={bulkNotes} 
                                        onChange={(e) => setBulkNotes(e.target.value)} 
                                    />
                                </div>

                                <div style={{ width: '100%' }}>
                                    <label style={{ display: 'block', marginBottom: '3px', fontSize: '0.85rem', fontWeight: 'bold' }}>Wochentage zum Ausfüllen</label>
                                    <div className="bulk-days-grid">
                                        {[
                                            { label: 'Mo', num: 1 },
                                            { label: 'Di', num: 2 },
                                            { label: 'Mi', num: 3 },
                                            { label: 'Do', num: 4 },
                                            { label: 'Fr', num: 5 },
                                            { label: 'Sa', num: 6 },
                                            { label: 'So', num: 0 },
                                        ].map(day => (
                                            <label key={day.num} className="bulk-day-label">
                                                <input 
                                                    type="checkbox" 
                                                    checked={bulkDays[day.num]} 
                                                    onChange={(e) => setBulkDays(prev => ({ ...prev, [day.num]: e.target.checked }))}
                                                />
                                                {day.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                                    <input 
                                        id="bulk-overwrite" 
                                        type="checkbox" 
                                        checked={bulkOverwrite} 
                                        onChange={(e) => setBulkOverwrite(e.target.checked)} 
                                    />
                                    <label htmlFor="bulk-overwrite" style={{ margin: 0, cursor: 'pointer', fontSize: '0.9rem' }}>
                                        Bereits vorhandene Einträge überschreiben
                                    </label>
                                </div>

                                <div style={{ marginTop: '15px', width: '100%' }}>
                                    <button type="submit" className="btn btn-add">⚡ Generieren & Speichern</button>
                                    <button type="button" className="btn btn-cancel" onClick={() => setShowBulkGen(false)}>Abbrechen</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {isLoading ? (
                        <h4>Zeitserfassung wird geladen...</h4>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th style={{ width: '160px' }}>Datum</th>
                                        <th style={{ width: '110px' }}>Beginn</th>
                                        <th style={{ width: '110px' }}>Ende</th>
                                        <th style={{ width: '90px' }}>Pause (Min.)</th>
                                        <th style={{ width: '110px' }}>Stunden</th>
                                        <th>Bemerkungen</th>
                                        <th className="actions" style={{ width: '150px' }}>Aktionen</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {daysData.map(day => {
                                        const worked = calculateHours(day.start_time, day.end_time, day.break_minutes);
                                        const compliance = checkCompliance(day.start_time, day.end_time, day.break_minutes);
                                        const isWeekend = day.dayOfWeekNum === 0 || day.dayOfWeekNum === 6;

                                        return (
                                            <tr key={day.dateStr} style={{ backgroundColor: isWeekend ? '#fbf8f0' : 'transparent' }}>
                                                <td data-label="Datum">
                                                    <div style={{ fontWeight: '500' }}>
                                                        {day.dayNum}.{String(selectedMonth).padStart(2, '0')}.{selectedYear}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                                        {day.dayOfWeekName}
                                                    </div>
                                                </td>
                                                <td data-label="Beginn">
                                                    <input 
                                                        type="time" 
                                                        className="timesheet-input" 
                                                        value={day.start_time} 
                                                        onChange={(e) => handleCellChange(day.dateStr, 'start_time', e.target.value)} 
                                                    />
                                                </td>
                                                <td data-label="Ende">
                                                    <input 
                                                        type="time" 
                                                        className="timesheet-input" 
                                                        value={day.end_time} 
                                                        onChange={(e) => handleCellChange(day.dateStr, 'end_time', e.target.value)} 
                                                    />
                                                </td>
                                                <td data-label="Pause">
                                                    <input 
                                                        type="number" 
                                                        className="timesheet-input" 
                                                        value={day.break_minutes} 
                                                        onChange={(e) => handleCellChange(day.dateStr, 'break_minutes', Math.max(0, parseInt(e.target.value, 10) || 0))} 
                                                        min="0"
                                                    />
                                                </td>
                                                <td data-label="Stunden">
                                                    <strong style={{ fontSize: '1.05rem' }}>
                                                        {worked > 0 ? `${worked.toFixed(2)} Std.` : '—'}
                                                    </strong>
                                                    
                                                    {/* Compliance Warnings based on German Labor Law */}
                                                    {!compliance.ok && (
                                                        <div>
                                                            {compliance.warnings.map((w, idx) => (
                                                                <span key={idx} className="compliance-warn" title={w}>
                                                                    ⚠️ {w.split('(')[0]}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td data-label="Bemerkungen">
                                                    <input 
                                                        type="text" 
                                                        className="timesheet-input" 
                                                        placeholder="Schicht-Details..." 
                                                        value={day.notes} 
                                                        onChange={(e) => handleCellChange(day.dateStr, 'notes', e.target.value)} 
                                                    />
                                                </td>
                                                <td data-label="Aktionen" className="actions">
                                                    <button 
                                                        className="btn btn-add" 
                                                        onClick={() => handleSaveDay(day)}
                                                        disabled={!day.start_time || !day.end_time}
                                                        style={{ opacity: (!day.start_time || !day.end_time) ? 0.5 : 1 }}
                                                        title="Speichern"
                                                    >
                                                        Speichern
                                                    </button>
                                                    <button 
                                                        className="btn btn-delete" 
                                                        onClick={() => handleClearDay(day)}
                                                        title="Leeren / Löschen"
                                                    >
                                                        {day.recordId ? "Löschen" : "Leeren"}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Signature space at bottom of document when printing */}
            <div className="print-signatures">
                <div className="signature-line">
                    <strong>Arbeitnehmer (Unterschrift des Mitarbeiters)</strong><br />
                    Datum & Unterschrift
                </div>
                <div className="signature-line">
                    <strong>Arbeitgeber (Akha Thai Massage)</strong><br />
                    Datum & Unterschrift
                </div>
            </div>
        </div>
    );
}

export default TimesheetManagementPage;
