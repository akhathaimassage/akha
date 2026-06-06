import React, { useState, useEffect } from 'react';
import { authFetch } from '../api/authFetch';
import './Modal.css'; 

function EditTherapistModal({ therapist, onClose, onSave }) {
    const [name, setName] = useState('');
    // 💡 เพิ่ม State ใหม่ 2 ตัว
    const [showOnWebsite, setShowOnWebsite] = useState(true);
    const [displayOrder, setDisplayOrder] = useState(99);

    useEffect(() => {
        if (therapist) {
            setName(therapist.full_name);
            // 💡 ดึงค่าเดิมมาแสดง (ถ้ามี)
            setShowOnWebsite(therapist.show_on_website !== false); // ถ้าเป็น null/undefined ให้ถือว่า true
            setDisplayOrder(therapist.display_order || 99);
        }
    }, [therapist]);

    if (!therapist) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await authFetch(`/api/therapists/${therapist.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                // 💡 ส่งค่า 3 อย่างไปหา Backend
                body: JSON.stringify({ 
                    full_name: name,
                    show_on_website: showOnWebsite,
                    display_order: displayOrder
                }),
            });
            if (!response.ok) throw new Error('Failed to update therapist');
            onSave(); 
            onClose(); 
        } catch (error) {
            console.error("Update error:", error);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Edit Therapist Profile</h2>
                    <button className="modal-close-button" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group" style={{ marginBottom: '15px' }}>
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

                        {/* 💡 ส่วนควบคุมการแสดงหน้าเว็บ (สวิตช์/Checkbox) */}
                        <div className="form-group" style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                                id="show-website"
                                type="checkbox"
                                checked={showOnWebsite}
                                onChange={(e) => setShowOnWebsite(e.target.checked)}
                                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                            />
                            <label htmlFor="show-website" style={{ margin: 0, cursor: 'pointer' }}>
                                โชว์โปรไฟล์บนหน้าเว็บสาธารณะ (About Us)
                            </label>
                        </div>

                        {/* 💡 ส่วนจัดลำดับ */}
                        <div className="form-group" style={{ marginBottom: '20px' }}>
                            <label htmlFor="display-order">ลำดับการแสดงผล (เลขน้อย ขึ้นก่อน)</label>
                            <input
                                id="display-order"
                                type="number"
                                value={displayOrder}
                                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 99)}
                                className="admin-form-input"
                                min="1"
                                style={{ width: '100px', display: 'block' }}
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