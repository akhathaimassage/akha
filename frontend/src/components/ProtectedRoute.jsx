import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute() {
    const { currentUser } = useAuth();

    // ถ้ามี currentUser (ล็อกอินแล้ว) ให้แสดง Component ลูก (ผ่าน Outlet)
    // ถ้าไม่มี ให้ส่งกลับไปที่หน้าหลัก (/)
    return currentUser ? <Outlet /> : <Navigate to="/" replace />;
}

export default ProtectedRoute;