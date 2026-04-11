import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const NAV = [
  { section: 'Overview' },
  { label: 'Dashboard',    path: '/dashboard',    icon: '\u2687', roles: ['admin', 'owner', 'manager', 'cashier'] },

  { section: 'Point of Sale' },
  { label: 'Register',     path: '/register',     icon: '\u229e', roles: ['admin', 'owner', 'manager', 'cashier'] },
  { label: 'Customers',    path: '/customers',    icon: '\u25c8', roles: ['admin', 'owner', 'manager', 'cashier'] },

  { section: 'Inventory' },
  { label: 'Inventory',    path: '/inventory',    icon: '\u25a6', roles: ['admin', 'owner', 'manager', 'cashier'] },
  { label: 'Consignors',   path: '/consignors',   icon: '\u25c7', roles: ['admin', 'owner', 'manager'] },

  { section: 'Services' },
  { label: 'Work Orders',  path: '/work-orders',  icon: '\u2699', roles: ['admin', 'owner', 'manager', 'cashier'] },
  { label: 'Trading',      path: '/trades',       icon: '\u2194', roles: ['admin', 'owner', 'manager', 'cashier'] },
  { label: 'Events',       path: '/events',       icon: '\u25ce', roles: ['admin', 'owner', 'manager'] },

  { section: 'Marketing' },
  { label: 'Media Hub',    path: '/media',        icon: '\ud83d\udcf7', roles: ['admin', 'owner', 'manager'] },
  { label: 'Marketing',    path: '/marketing',    icon: '\ud83d\udce3', roles: ['admin', 'owner', 'manager'] },
  { label: 'Online Store', path: '/online-store', icon: '\ud83d\uded2', roles: ['admin', 'owner', 'manager'] },

  { section: 'Admin' },
  { label: 'Import Data',  path: '/imports',      icon: '\u2193',  roles: ['admin', 'owner', 'manager'] },
  { label: 'Staff',        path: '/staff',        icon: '\u25d1',  roles: ['admin', 'owner'] },
  { label: 'Tasks',        path: '/tasks',        icon: '\u25b7',  roles: ['admin', 'owner', 'manager', 'cashier'] },
  { label: 'Schedule',     path: '/schedule',     icon: '\u25a4',  roles: ['admin', 'owner', 'manager', 'cashier'] },
  { label: 'Time Clock',   path: '/timeclock',    icon: '\u25c9',  roles: ['admin', 'owner', 'manager', 'cashier'] },

  { section: 'Reports' },
  { label: 'Reports',      path: '/reports',      icon: '\u25eb',  roles: ['admin', 'owner', 'manager'] },
  { label: 'Analytics',    path: '/analytics',    icon: '\u25c8',  roles: ['admin', 'owner', 'manager'] },
  { label: 'Activity',     path: '/activity',     icon: '\u25b8',  roles: ['admin', 'owner', 'manager'] },
];

export default function Sidebar() {
  const { user, logout, can } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        bjnhPOS
        <span>USED MUSIC &amp; MORE</span>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item, i) => {
          if (item.section) {
            return <div key={`s-${i}`} className="sidebar-section">{item.section}</div>;
          }
          if (\!can(item.roles)) return null;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/dashboard'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span style={{ fontSize: 14, opacity: 0.7 }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <strong>{user?.name || 'User'}</strong>
          {user?.role || 'unknown'}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm w-full"
          style={{ marginTop: 10 }}
          onClick={logout}
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
