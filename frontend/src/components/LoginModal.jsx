import React, { useState, useMemo } from 'react'; // ★ 1. เพิ่ม useMemo
import { useAuth } from '../context/AuthContext';
import './LoginModal.css';

function LoginModal({ isOpen, onClose }) {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false); // ★ 2. เพิ่ม state สำหรับกันการกดซ้ำ

    // ★ 3. สร้างตัวแปรเช็คว่าฟอร์มพร้อมที่จะกดส่งหรือไม่
    const isFormValid = useMemo(() => {
        return username.trim() !== '' && password.trim() !== '' && !isSubmitting;
    }, [username, password, isSubmitting]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isFormValid) return; // ป้องกันการ submit ถ้าฟอร์มไม่สมบูรณ์

        setIsSubmitting(true); // เริ่มกระบวนการ, ปุ่มจะถูก disable
        setError('');

        try {
            const response = await fetch('http://192.168.1.35:3001/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }
            
            login(data.token);
            onClose();

        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false); // ★ 4. คืนสถานะปุ่มให้กดได้ ไม่ว่าผลลัพธ์จะเป็นอย่างไร
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="login-modal-overlay" onClick={onClose}>
            <div className="login-modal-card" onClick={e => e.stopPropagation()}>
                <div className="login-modal-header">
                    <h2>Login</h2>
                    <button className="login-modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="login-modal-body">
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="username">Username</label>
                            <input type="text" id="username" value={username} onChange={e => setUsername(e.target.value)} required />
                        </div>
                        <div className="form-group">
                            <label htmlFor="password">Password</label>
                            <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} required />
                        </div>
                        {error && <p className="error-message">{error}</p>}
                        
                        {/* ★ 5. เพิ่ม attribute 'disabled' และเปลี่ยนข้อความในปุ่ม */}
                        <button type="submit" className="submit-login-btn" disabled={!isFormValid}>
                            {isSubmitting ? 'Logging in...' : 'Login'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default LoginModal;