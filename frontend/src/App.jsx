import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import WelcomePage from './pages/WelcomePage';
import AdminLayout from './layouts/AdminLayout';
import AdminSchedulePage from './pages/AdminSchedulePage';
import TherapistManagementPage from './pages/TherapistManagementPage';
import ServiceManagementPage from './pages/ServiceManagementPage';
import UserManagementPage from './pages/UserManagementPage';
import BookingManagementPage from './pages/BookingManagementPage';
import DashboardPage from './pages/DashboardPage';
import ProtectedRoute from './components/ProtectedRoute';


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
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="therapists" element={<TherapistManagementPage />} />
              <Route path="services" element={<ServiceManagementPage />} />
              <Route path="bookings" element={<BookingManagementPage />} />
              <Route path="users" element={<UserManagementPage />} />
            </Route>
          </Route>
          <Route path="*" element={<h1>404 Not Found</h1>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;