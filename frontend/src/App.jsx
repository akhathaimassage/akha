import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import WelcomePage from './pages/WelcomePage';
import AdminLayout from './layouts/AdminLayout';
import AdminSchedulePage from './pages/AdminSchedulePage';
import TherapistManagementPage from './pages/TherapistManagementPage';
import ServiceManagementPage from './pages/ServiceManagementPage';
import UserManagementPage from './pages/UserManagementPage';
import BookingManagementPage from './pages/BookingManagementPage';
import DashboardPage from './pages/DashboardPage';
import TimesheetManagementPage from './pages/TimesheetManagementPage'; // ★ Import new page
import ProtectedRoute from './components/ProtectedRoute';

function AdminOnlyRoute({ children }) {
  const { currentUser } = useAuth();
  if (currentUser?.role === 'staff') {
    return <Navigate to="/admin/schedule" replace />;
  }
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminSchedulePage />} />
              <Route path="schedule" element={<AdminSchedulePage />} />
              <Route path="dashboard" element={<AdminOnlyRoute><DashboardPage /></AdminOnlyRoute>} />
              <Route path="therapists" element={<AdminOnlyRoute><TherapistManagementPage /></AdminOnlyRoute>} />
              <Route path="services" element={<AdminOnlyRoute><ServiceManagementPage /></AdminOnlyRoute>} />
              <Route path="bookings" element={<AdminOnlyRoute><BookingManagementPage /></AdminOnlyRoute>} />
              <Route path="users" element={<AdminOnlyRoute><UserManagementPage /></AdminOnlyRoute>} />
              <Route path="timesheets" element={<AdminOnlyRoute><TimesheetManagementPage /></AdminOnlyRoute>} />
            </Route>
          </Route>
          <Route path="*" element={<h1>404 Not Found</h1>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;