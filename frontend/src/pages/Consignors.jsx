import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useToast } from '../hooks/useToast';

const BLANK = { name: '', email: '', phone: '', split_percentage: 50, booth_fee_monthly: 0, payout_schedule: 'monthly', minimum_payout_balance: 0, contract_start: '' };

export default function Consignors() {
  const { show, Toast } = useToast();
  const [consignors, setConsignors] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [detail, setDetail] = useState(null);
  const [payoutMethod, setPayoutMethod] = useState('cash');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/consignors${search ? `?search=${search}` : ''}`);
      setConsignors(res.data);
    } catch { show('Failed to load.', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search]);

  const openDetail = async (c) => {
    const res = await api.get(`/consignors/${c.id}`);
    setDetail(res.data);
  };

  const save = async () => {
    try {
      if (modal === 'add') {
        await api.post('/consignors', form);
        show('Consignor added.', 'success');
      } else {
        await api.patch(`/consignors/${modal.id}`, { ...form, active: true });
        show('Consignor updated.', 'success');
      }
      setModal(null); load();
    } catch { show('Save failed.', 'error'); }
  };

  const processPayout = async () => {
    try {
      await api.post(`/consignors/${detail.id}/payout`, { method: payoutMethod, triggered_by: 'schedule' });
      show('Payout processed.', 'success');
      openDetail(detail);
    } catch (err) { show(err.response?.data?.error || 'Payout failed.', 'error'); }
  };

  const f = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="main-content">
      {Toast}
      <div className="page-header">
        <h2>Consignors</h2>
        <button className="btn btn-primary" onClick={() => { setForm(BLANK); setModal('add'); }}>+ Add Consignor</button>
      </div>

      <div className="card">
        <div className="card-header">
          <input className="input" placeholder="Search consignors..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
          <span className="text-muted text-sm text-mono">{consignors.length} consignors</span>
        </div>
        <div className="table-wrap">
          {loading ? <div className="empty-state">Loading...</div> : consignors.length === 0 ? (
            <div className="empty-state">No consignors found</div>
          ) : (
            <table>
              <thead>
                <tr><th>Name</th><th>Split</th><th>Booth Fee</th><th>Balance Owed</th><th>Schedule</th><th></th></tr>
              </thead>
              <tbody>
                {consignors.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 500 }}>{c.name}
                      <div className="text-sm text-muted">{c.email}</div>
                    </td>
                    <td className="text-mono text-accent">{c.split_percentage}%</td>
                    <td className="text-mono">${parseFloat(c.booth_fee_monthly).toFixed(2)}/mo</td>
                    <td className="text-mono" style={{ color: parseFloat(c.balance) > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                      ${parseFloat(c.balance).toFixed(2)}
                    </td>
                    <td className="text-sm text-muted">{c.payout_schedule}</td>
                    <td>
                      <div className="flex gap-8">
                        <button className="btn btn-sm btn-ghost" onClick={() => openDetail(c)}>View</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => { setForm({ name: c.name, email: c.email || '', phone: c.phone || '', split_percentage: c.split_percentage, booth_fee_monthly: c.booth_fee_monthly, payout_schedule: c.payout_schedule, minimum_payout_balance: c.minimum_payout_balance, contract_start: c.contract_start?.split('T')[0] || '' }); setModal(c); }}>Edit</button>
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
              <h3>{modal === 'add' ? 'Add Consignor' : 'Edit Consignor'}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-group full"><label>Name</label><input className="input" value={form.name} onChange={f('name')} /></div>
              <div className="form-group"><label>Email</label><input className="input" value={form.email} onChange={f('email')} /></div>
              <div className="form-group"><label>Phone</label><input className="input" value={form.phone} onChange={f('phone')} /></div>
              <div className="form-group"><label>Split % (consignor's cut)</label><input className="input" type="number" min="0" max="100" value={form.split_percentage} onChange={f('split_percentage')} /></div>
              <div className="form-group"><label>Monthly Booth Fee ($)</label><input className="input" type="number" min="0" step="0.01" value={form.booth_fee_monthly} onChange={f('booth_fee_monthly')} /></div>
              <div className="form-group"><label>Payout Schedule</label>
                <select className="input" value={form.payout_schedule} onChange={f('payout_schedule')}>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="form-group"><label>Minimum Payout Balance ($)</label><input className="input" type="number" min="0" step="0.01" value={form.minimum_payout_balance} onChange={f('minimum_payout_balance')} /></div>
              <div className="form-group"><label>Contract Start Date</label><input className="input" type="date" value={form.contract_start} onChange={f('contract_start')} /></div>
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
          <div className="modal" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <div>
                <h3>{detail.name}</h3>
                <span className="text-muted text-sm text-mono">{detail.email} · {detail.split_percentage}% split · ${parseFloat(detail.booth_fee_monthly).toFixed(2)}/mo booth</span>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="flex gap-12">
              <div className="stat-card" style={{ flex: 1 }}>
                <div className="stat-label">Balance Owed</div>
                <div className="stat-value" style={{ fontSize: '1.6rem' }}>${parseFloat(detail.balance).toFixed(2)}</div>
              </div>
              <div className="stat-card" style={{ flex: 1 }}>
                <div className="stat-label">Active Items</div>
                <div className="stat-value" style={{ fontSize: '1.6rem' }}>{detail.items?.filter(i => i.status === 'active').length}</div>
              </div>
              <div className="stat-card" style={{ flex: 1 }}>
                <div className="stat-label">Sold Items</div>
                <div className="stat-value" style={{ fontSize: '1.6rem' }}>{detail.items?.filter(i => i.status === 'sold').length}</div>
              </div>
            </div>

            {parseFloat(detail.balance) > 0 && (
              <div className="card" style={{ background: 'var(--surface2)' }}>
                <h3 style={{ marginBottom: 12 }}>Process Payout</h3>
                <div className="flex gap-8 items-center">
                  <select className="input" value={payoutMethod} onChange={e => setPayoutMethod(e.target.value)} style={{ maxWidth: 180 }}>
                    <option value="cash">Cash</option>
                    <option value="store_credit">Store Credit</option>
                  </select>
                  <button className="btn btn-primary" onClick={processPayout}>
                    Pay ${parseFloat(detail.balance).toFixed(2)}
                  </button>
                </div>
              </div>
            )}

            <div>
              <h3 style={{ marginBottom: 12 }}>Active Items</h3>
              <div className="table-wrap" style={{ maxHeight: 200, overflowY: 'auto' }}>
                <table>
                  <thead><tr><th>Title</th><th>Condition</th><th>Price</th><th>Added</th></tr></thead>
                  <tbody>
                    {detail.items?.filter(i => i.status === 'active').map(item => (
                      <tr key={item.id}>
                        <td>{item.title}</td>
                        <td className="text-sm text-mono">{item.condition}</td>
                        <td className="text-mono text-accent">${parseFloat(item.price).toFixed(2)}</td>
                        <td className="text-sm text-muted text-mono">{new Date(item.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 style={{ marginBottom: 12 }}>Payout History</h3>
              {detail.payouts?.length === 0 ? <div className="empty-state">No payouts yet</div> : (
                <div className="table-wrap" style={{ maxHeight: 180, overflowY: 'auto' }}>
                  <table>
                    <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Triggered By</th></tr></thead>
                    <tbody>
                      {detail.payouts?.map(p => (
                        <tr key={p.id}>
                          <td className="text-mono text-sm">{new Date(p.created_at).toLocaleDateString()}</td>
                          <td className="text-mono text-accent">${parseFloat(p.amount).toFixed(2)}</td>
                          <td className="text-sm">{p.method.replace('_', ' ')}</td>
                          <td className="text-sm text-muted">{p.triggered_by}</td>
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
