import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { authFetch } from '../api/authFetch'; // ★ 1. เพิ่มบรรทัดนี้ (แก้ path ถ้าจำเป็น)
import './LoginModal.css';

function LoginModal({ isOpen, onClose }) {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isFormValid = useMemo(() => {
        return username.trim() !== '' && password.trim() !== '' && !isSubmitting;
    }, [username, password, isSubmitting]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!isFormValid) return;

        setIsSubmitting(true);
        setError('');

        try {
            // ★ 2. แก้ไขการเรียก API ให้ใช้ authFetch และ URL ที่ถูกต้อง
            const response = await authFetch('/api/auth/login', {
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
            setIsSubmitting(false);
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