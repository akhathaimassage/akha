import React, { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../api/authFetch'; // ★ 1. Import authFetch
import './ScheduleModal.css';

const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function ScheduleModal({ therapist, onClose }) {
    const [schedules, setSchedules] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newSchedule, setNewSchedule] = useState({
        day_of_week: '1',
        start_time: '09:00',
        end_time: '18:00'
    });

    const fetchSchedules = useCallback(async () => {
        setIsLoading(true);
        try {
            // ★ 2. Use authFetch here
            const response = await authFetch(`/api/therapists/${therapist.id}/schedules`);
            const data = await response.json();
            setSchedules(data);
        } catch (error) {
            console.error("Failed to fetch schedules:", error);
        } finally {
            setIsLoading(false);
        }
    }, [therapist.id]);

    useEffect(() => {
        fetchSchedules();
    }, [fetchSchedules]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewSchedule(prevState => ({ ...prevState, [name]: value }));
    };

    const handleAddSchedule = async (e) => {
        e.preventDefault();
        try {
            // ★ 2. Use authFetch here
            await authFetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...newSchedule, therapist_id: therapist.id }),
            });
            fetchSchedules();
        } catch (error) {
            console.error("Failed to add schedule:", error);
        }
    };

    const handleDeleteSchedule = async (scheduleId) => {
        if (window.confirm('Are you sure you want to delete this schedule?')) {
            try {
                // ★ 2. Use authFetch here
                await authFetch(`/api/schedules/${scheduleId}`, { method: 'DELETE' });
                fetchSchedules();
            } catch (error) {
                console.error("Failed to delete schedule:", error);
            }
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Manage Schedule for {therapist.full_name}</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    {isLoading ? <p>Loading schedules...</p> : (
                        <ul className="schedule-list">
                            {schedules.map(schedule => (
                                <li key={schedule.id}>
                                    <span>
                                        <strong>{daysOfWeek[schedule.day_of_week]}:</strong> {schedule.start_time} - {schedule.end_time}
                                    </span>
                                    <button onClick={() => handleDeleteSchedule(schedule.id)} className="delete-schedule-btn">Delete</button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <form onSubmit={handleAddSchedule} className="add-schedule-form">
                        <h3>Add/Update Schedule</h3>
                        <select name="day_of_week" value={newSchedule.day_of_week} onChange={handleInputChange}>
                            {daysOfWeek.map((day, index) => (
                                <option key={index} value={index}>{day}</option>
                            ))}
                        </select>
                        <input type="time" name="start_time" value={newSchedule.start_time} onChange={handleInputChange} />
                        <input type="time" name="end_time" value={newSchedule.end_time} onChange={handleInputChange} />
                        <button type="submit" className="btn-add">Save</button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default ScheduleModal;