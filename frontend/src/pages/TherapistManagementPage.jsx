import React, { useState, useEffect, useCallback } from 'react';
import './Admin.css';
import ScheduleModal from '../components/ScheduleModal';
import EditTherapistModal from '../components/EditTherapistModal'; // Import the new modal
import { authFetch } from '../api/authFetch';

function TherapistManagementPage() {
    const [therapists, setTherapists] = useState([]);
    const [newTherapistName, setNewTherapistName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [editingScheduleFor, setEditingScheduleFor] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentTherapist, setCurrentTherapist] = useState(null);

    const fetchTherapists = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await authFetch('/api/therapists/all');
            const data = await response.json();
            setTherapists(data);
        } catch (error) {
            console.error("Failed to fetch therapists:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTherapists();
    }, [fetchTherapists]);

    const openEditModal = (therapist) => {
        setCurrentTherapist(therapist);
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setCurrentTherapist(null);
    };

    const handleAddTherapist = async (e) => {
        e.preventDefault();
        if (!newTherapistName.trim()) return;
        try {
            await authFetch('/api/therapists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: newTherapistName }),
            });
            setNewTherapistName('');
            fetchTherapists();
        } catch (error) {
            console.error("Failed to add therapist:", error);
        }
    };

    const handleToggleActive = async (id, isActive) => {
        try {
            await authFetch(`/api/therapists/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !isActive }),
            });
            fetchTherapists();
        } catch (error) {
            console.error("Failed to toggle status:", error);
        }
    };

    const handlePermanentDelete = async (id, name) => {
        const confirmation = prompt(`This will permanently delete ${name}. To confirm, type their name below:`);
        if (confirmation === name) {
            try {
                const response = await authFetch(`/api/therapists/${id}/permanent`, { method: 'DELETE' });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error);
                alert(`${name} has been permanently deleted.`);
                fetchTherapists();
            } catch (error) {
                alert(`Error: ${error.message}`);
            }
        } else if (confirmation !== null) {
            alert("The name did not match. Deletion cancelled.");
        }
    };

    if (isLoading) {
        return <div className="admin-card"><h2>Loading...</h2></div>;
    }

    return (
        <div>
            <h1>Therapist Management</h1>
            <div className="admin-card">
                <h3>Add New Therapist</h3>
                <form onSubmit={handleAddTherapist} className="admin-form">
                    <input
                        type="text"
                        className="admin-form-input"
                        value={newTherapistName}
                        onChange={(e) => setNewTherapistName(e.target.value)}
                        placeholder="Enter new therapist's name"
                    />
                    <button type="submit" className="btn btn-add">Add</button>
                </form>
            </div>

            <div className="admin-card">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {therapists.map(therapist => (
                            <tr key={therapist.id} className={!therapist.is_active ? 'deactivated' : ''}>
                                <td data-label="ID">{therapist.id}</td>
                                <td data-label="Name">{therapist.full_name}</td>
                                <td data-label="Status">
                                    <span 
                                        className={`status-toggle ${therapist.is_active ? 'active' : ''}`}
                                        onClick={() => handleToggleActive(therapist.id, therapist.is_active)}
                                    >
                                        {therapist.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td data-label="Actions" className="actions">
                                    <button className="btn btn-edit" onClick={() => openEditModal(therapist)}>Edit Name</button>
                                    <button className="btn" style={{backgroundColor: '#6c757d'}} onClick={() => setEditingScheduleFor(therapist)}>
                                        Schedule
                                    </button>
                                    <button className="btn btn-delete" onClick={() => handlePermanentDelete(therapist.id, therapist.full_name)}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {editingScheduleFor && (
                <ScheduleModal 
                    therapist={editingScheduleFor} 
                    onClose={() => setEditingScheduleFor(null)} 
                />
            )}
            
            {isEditModalOpen && (
                <EditTherapistModal 
                    therapist={currentTherapist}
                    onClose={closeEditModal}
                    onSave={fetchTherapists}
                />
            )}
        </div>
    );
}

export default TherapistManagementPage;