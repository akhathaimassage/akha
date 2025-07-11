import React, { useState, useEffect } from 'react';
import { authFetch } from '../api/authFetch';
import './Modal.css'; // You can reuse the modal styles

function EditTherapistModal({ therapist, onClose, onSave }) {
    const [name, setName] = useState('');

    useEffect(() => {
        if (therapist) {
            setName(therapist.full_name);
        }
    }, [therapist]);

    if (!therapist) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await authFetch(`/api/therapists/${therapist.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ full_name: name }),
            });
            if (!response.ok) throw new Error('Failed to update therapist');
            onSave(); // Trigger data refresh on the parent page
            onClose(); // Close the modal
        } catch (error) {
            console.error("Update error:", error);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Edit Therapist</h2>
                    <button className="modal-close-button" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="therapist-name">Therapist Name</label>
                            <input
                                id="therapist-name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="admin-form-input"
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-add">Save Changes</button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default EditTherapistModal;