import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/common/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Consignors from './pages/Consignors';
import WorkOrders from './pages/WorkOrders';
import { Staff, Tasks, Schedule, TimeClock, Reports, Activity } from './pages/StaffPages';
import './index.css';

function ProtectedLayout() {
  const { user } = useAuth();
  if (\!user) return <Navigate to="/login" />;
  return (
    <div className="app-layout">
      <Sidebar />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/"           element={<Register />} />
          <Route path="/inventory"  element={<Inventory />} />
          <Route path="/customers"  element={<Customers />} />
          <Route path="/consignors" element={<Consignors />} />
          <Route path="/work-orders" element={<WorkOrders />} />
          <Route path="/staff"      element={<Staff />} />
          <Route path="/tasks"      element={<Tasks />} />
          <Route path="/schedule"   element={<Schedule />} />
          <Route path="/timeclock"  element={<TimeClock />} />
          <Route path="/reports"    element={<Reports />} />
          <Route path="/activity"   element={<Activity />} />
          <Route path="*"           element={<Navigate to="/" />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*"     element={<ProtectedLayout />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
