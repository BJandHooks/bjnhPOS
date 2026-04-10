import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '24px'
    }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '3rem', marginBottom: '4px' }}>bjnhPOS</h1>
          <p style={{ fontFamily: 'var(--mono)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Point of Sale System
          </p>
        </div>
        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label>Email</label>
              <input className="input" type="email" value={email}
                onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input className="input" type="password" value={password}
                onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-danger text-sm">{error}</p>}
            <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
