// บรรทัดนี้จะอ่านค่า VITE_API_URL จากไฟล์ .env ที่เหมาะสมโดยอัตโนมัติ
// - ตอนรัน npm run dev -> จะดึงจาก .env.development (http://localhost:3001)
// - ตอนรัน npm run build -> จะดึงจาก .env.production (https://your-backend.onrender.com)
// ถ้าไม่เจอค่าใน .env เลย จะใช้ 'http://localhost:3001' เป็นค่าสำรองสำหรับตอนพัฒนา
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('token');

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${BASE_URL}${url}`, {
            ...options,
            headers,
        });

        if ((response.status === 401 || response.status === 403) && !url.includes('/api/auth/login')) {
            localStorage.removeItem('token');
            // อาจจะ redirect ไปหน้า login หรือหน้าแรก
            window.location.href = '/'; 
            throw new Error('Session expired. Please log in again.');
        }

        return response;

    } catch (error) {
        console.error('Fetch error:', error);
        throw error; // ส่ง error ต่อเพื่อให้ component ที่เรียกใช้จัดการได้
    }
};