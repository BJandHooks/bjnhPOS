import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('bjnh_user');
    return stored ? JSON.parse(stored) : null;
  });

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('bjnh_token', res.data.token);
    localStorage.setItem('bjnh_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('bjnh_token');
    localStorage.removeItem('bjnh_user');
    setUser(null);
  };

  const can = (roles) => roles.includes(user?.role);

  return (
    <AuthContext.Provider value={{ user, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
