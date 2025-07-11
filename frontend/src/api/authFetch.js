export const authFetch = async (url, options = {}) => {
    // 1. ดึง token จาก localStorage
    const token = localStorage.getItem('token');
    const BASE_URL = 'https://akha-massage-api.onrender.com';

    // 2. เตรียม Headers เริ่มต้น
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // 3. ถ้ามี token, ให้เพิ่ม Authorization header เข้าไป
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // 4. ส่งคำขอ fetch พร้อม header ที่มี token
     const response = await fetch(`${BASE_URL}${url}`, {
        ...options,
        headers,
    });


    // 5. ถ้า token หมดอายุหรือไม่มีสิทธิ์ ให้ logout อัตโนมัติ
    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token');
        window.location.href = '/'; // ส่งกลับไปหน้าแรก
        throw new Error('Session expired. Please log in again.');
    }

    return response;
};