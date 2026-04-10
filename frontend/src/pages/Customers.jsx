import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useToast } from '../hooks/useToast';

const BLANK = { name: '', email: '', phone: '' };

export default function Customers() {
  const { show, Toast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [detail, setDetail] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/customers${search ? `?search=${search}` : ''}`);
      setCustomers(res.data);
    } catch { show('Failed to load.', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search]);

  const openDetail = async (c) => {
    const res = await api.get(`/customers/${c.id}`);
    setDetail(res.data);
  };

  const save = async () => {
    try {
      if (modal === 'add') {
        await api.post('/customers', form);
        show('Customer added.', 'success');
      } else {
        await api.patch(`/customers/${modal.id}`, form);
        show('Customer updated.', 'success');
      }
      setModal(null); load();
    } catch { show('Save failed.', 'error'); }
  };

  return (
    <div className="main-content">
      {Toast}
      <div className="page-header">
        <h2>Customers</h2>
        <button className="btn btn-primary" onClick={() => { setForm(BLANK); setModal('add'); }}>+ Add Customer</button>
      </div>

      <div className="card">
        <div className="card-header">
          <input className="input" placeholder="Search by name, email, or phone..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
          <span className="text-muted text-sm text-mono">{customers.length} customers</span>
        </div>
        <div className="table-wrap">
          {loading ? <div className="empty-state">Loading...</div> : customers.length === 0 ? (
            <div className="empty-state">No customers found</div>
          ) : (
            <table>
              <thead>
                <tr><th>Name</th><th>Email</th><th>Phone</th><th>Points</th><th>Store Credit</th><th>Since</th><th></th></tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.name}</td>
                    <td className="text-muted text-sm">{c.email || '—'}</td>
                    <td className="text-muted text-sm text-mono">{c.phone || '—'}</td>
                    <td className="text-mono text-accent">{c.loyalty_points}</td>
                    <td className="text-mono">${parseFloat(c.store_credit_balance).toFixed(2)}</td>
                    <td className="text-muted text-sm text-mono">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="flex gap-8">
                        <button className="btn btn-sm btn-ghost" onClick={() => openDetail(c)}>History</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => { setForm({ name: c.name, email: c.email || '', phone: c.phone || '' }); setModal(c); }}>Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{modal === 'add' ? 'Add Customer' : 'Edit Customer'}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="form-grid cols-1">
              {['name', 'email', 'phone'].map(field => (
                <div className="form-group" key={field}>
                  <label style={{ textTransform: 'capitalize' }}>{field}</label>
                  <input className="input" value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div className="modal" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <div>
                <h3>{detail.name}</h3>
                <span className="text-muted text-sm text-mono">{detail.email} · {detail.phone}</span>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="flex gap-16">
              {[['Loyalty Points', detail.loyalty_points], ['Store Credit', `$${parseFloat(detail.store_credit_balance).toFixed(2)}`]].map(([l, v]) => (
                <div className="stat-card" key={l} style={{ flex: 1 }}>
                  <div className="stat-label">{l}</div>
                  <div className="stat-value" style={{ fontSize: '1.6rem' }}>{v}</div>
                </div>
              ))}
            </div>
            <div>
              <h3 style={{ marginBottom: 12 }}>Purchase History</h3>
              {detail.sales?.length === 0 ? <div className="empty-state">No purchases yet</div> : (
                <div className="table-wrap" style={{ maxHeight: 300, overflowY: 'auto' }}>
                  <table>
                    <thead><tr><th>Date</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
                    <tbody>
                      {detail.sales?.map(s => (
                        <tr key={s.id}>
                          <td className="text-mono text-sm">{new Date(s.created_at).toLocaleDateString()}</td>
                          <td className="text-muted text-sm">{s.items?.length || 0} item(s)</td>
                          <td className="text-mono text-accent">${parseFloat(s.total).toFixed(2)}</td>
                          <td><span className={`badge badge-${s.status === 'complete' ? 'active' : 'expired'}`}>{s.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
