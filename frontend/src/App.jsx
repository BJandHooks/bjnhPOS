import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/common/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Consignors from './pages/Consignors';
import WorkOrders from './pages/WorkOrders';
import Trades from './pages/Trades';
import Imports from './pages/Imports';
import Events from './pages/Events';
import Media from './pages/Media';
import OnlineStore from './pages/OnlineStore';
import Analytics from './pages/Analytics';
import Marketing from './pages/Marketing';
import ConsignorPortal from './pages/ConsignorPortal';
import { Staff, Tasks, Schedule, TimeClock, Reports, Activity } from './pages/StaffPages';
import './index.css';

function ProtectedLayout() {
  const { user } = useAuth();
  if (\!user) return <Navigate to="/login" replace />;
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/portal/*" element={<ConsignorPortal />} />

          <Route path="/" element={<ProtectedLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"    element={<Dashboard />} />
            <Route path="register"     element={<Register />} />
            <Route path="inventory"    element={<Inventory />} />
            <Route path="customers"    element={<Customers />} />
            <Route path="consignors"   element={<Consignors />} />
            <Route path="work-orders"  element={<WorkOrders />} />
            <Route path="trades"       element={<Trades />} />
            <Route path="imports"      element={<Imports />} />
            <Route path="events"       element={<Events />} />
            <Route path="media"        element={<Media />} />
            <Route path="marketing"    element={<Marketing />} />
            <Route path="online-store" element={<OnlineStore />} />
            <Route path="staff"        element={<Staff />} />
            <Route path="tasks"        element={<Tasks />} />
            <Route path="schedule"     element={<Schedule />} />
            <Route path="timeclock"    element={<TimeClock />} />
            <Route path="reports"      element={<Reports />} />
            <Route path="analytics"    element={<Analytics />} />
            <Route path="activity"     element={<Activity />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
