import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { section: 'Register' },
  { label: 'Register', path: '/',            icon: '⬡', roles: ['owner','manager','cashier'] },
  { label: 'Customers', path: '/customers',  icon: '◈', roles: ['owner','manager','cashier'] },
  { section: 'Inventory' },
  { label: 'Inventory', path: '/inventory',  icon: '▦', roles: ['owner','manager','cashier'] },
  { label: 'Consignors', path: '/consignors',icon: '◇', roles: ['owner','manager'] },
  { section: 'Services' },
  { label: 'Work Orders', path: '/work-orders', icon: '⚙', roles: ['owner','manager','cashier'] },
  { section: 'Staff' },
  { label: 'Tasks',     path: '/tasks',      icon: '▷', roles: ['owner','manager','cashier'] },
  { label: 'Schedule',  path: '/schedule',   icon: '▤', roles: ['owner','manager','cashier'] },
  { label: 'Time Clock',path: '/timeclock',  icon: '◉', roles: ['owner','manager','cashier'] },
  { section: 'Reports' },
  { label: 'Reports',   path: '/reports',    icon: '◫', roles: ['owner','manager'] },
  { label: 'Activity',  path: '/activity',   icon: '▸', roles: ['owner','manager'] },
  { section: 'Admin' },
  { label: 'Staff',     path: '/staff',      icon: '◑', roles: ['owner'] },
];

export default function Sidebar() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        bjnhPOS
        <span>USED MUSIC &amp; MORE</span>
      </div>
      <nav className="sidebar-nav">
        {NAV.map((item, i) => {
          if (item.section) {
            return <div key={i} className="sidebar-section">{item.section}</div>;
          }
          if (\!can(item.roles)) return null;
          const active = location.pathname === item.path;
          return (
            <button key={item.path} className={`nav-item ${active ? 'active' : ''}`}
              onClick={() => navigate(item.path)}>
              <span style={{ fontSize: '14px', opacity: 0.7 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <strong>{user?.name}</strong>
          {user?.role}
        </div>
        <button className="btn btn-ghost btn-sm w-full" style={{ marginTop: '10px' }}
          onClick={logout}>Sign Out</button>
      </div>
    </div>
  );
}
