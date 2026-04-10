import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';

const CONDITIONS = ['mint', 'excellent', 'good', 'fair', 'poor'];
const BLANK_ITEM = { title: '', description: '', condition: 'good', category: '', price: '', barcode: '', consignor_id: '', expiration_date: '' };

export default function Inventory() {
  const { can } = useAuth();
  const { show, Toast } = useToast();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'add' | item object
  const [form, setForm] = useState(BLANK_ITEM);
  const [consignors, setConsignors] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      const res = await api.get(`/inventory?${params}`);
      setItems(res.data);
    } catch { show('Failed to load inventory.', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, statusFilter]);

  useEffect(() => {
    api.get('/consignors').then(r => setConsignors(r.data)).catch(() => {});
  }, []);

  const openAdd = () => { setForm(BLANK_ITEM); setModal('add'); };
  const openEdit = (item) => {
    setForm({
      title: item.title, description: item.description || '', condition: item.condition || 'good',
      category: item.category || '', price: item.price, barcode: item.barcode || '',
      consignor_id: item.consignor_id || '', expiration_date: item.expiration_date?.split('T')[0] || '',
    });
    setModal(item);
  };

  const save = async () => {
    try {
      if (modal === 'add') {
        await api.post('/inventory', { ...form, consignor_id: form.consignor_id || null });
        show('Item added.', 'success');
      } else {
        await api.patch(`/inventory/${modal.id}`, { ...form, consignor_id: form.consignor_id || null });
        show('Item updated.', 'success');
      }
      setModal(null);
      load();
    } catch (err) { show(err.response?.data?.error || 'Save failed.', 'error'); }
  };

  const markStatus = async (id, status) => {
    try {
      await api.patch(`/inventory/${id}`, { status });
      show(`Item marked as ${status}.`, 'success');
      load();
    } catch { show('Update failed.', 'error'); }
  };

  const counts = { active: 0, sold: 0, expired: 0 };
  items.forEach(i => { if (counts[i.status] !== undefined) counts[i.status]++; });

  return (
    <div className="main-content">
      {Toast}
      <div className="page-header">
        <h2>Inventory</h2>
        {can(['owner', 'manager']) && (
          <button className="btn btn-primary" onClick={openAdd}>+ Add Item</button>
        )}
      </div>

      <div className="stats-row">
        {[['Active', counts.active, 'badge-active'], ['Sold', counts.sold, 'badge-sold'], ['Expired', counts.expired, 'badge-expired']].map(([label, val, cls]) => (
          <div className="stat-card" key={label}>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{val}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="search-bar">
            <input className="input" placeholder="Search by title or barcode..." value={search}
              onChange={e => setSearch(e.target.value)} />
            <select className="input" style={{ width: 140 }} value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="sold">Sold</option>
              <option value="expired">Expired</option>
              <option value="donated">Donated</option>
              <option value="returned">Returned</option>
            </select>
          </div>
          <span className="text-muted text-sm text-mono">{items.length} items</span>
        </div>
        <div className="table-wrap">
          {loading ? <div className="empty-state">Loading...</div> : items.length === 0 ? (
            <div className="empty-state">No items found</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Title</th><th>Condition</th><th>Category</th>
                  <th>Price</th><th>Consignor</th><th>Status</th><th>Added</th>
                  {can(['owner', 'manager']) && <th></th>}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td><span style={{ fontWeight: 500 }}>{item.title}</span>
                      {item.barcode && <span className="text-mono text-sm text-muted" style={{ marginLeft: 8 }}>{item.barcode}</span>}
                    </td>
                    <td className="text-mono text-sm">{item.condition || '—'}</td>
                    <td className="text-muted text-sm">{item.category || '—'}</td>
                    <td className="text-mono text-accent">${parseFloat(item.price).toFixed(2)}</td>
                    <td className="text-sm">{item.consignor_name || <span className="text-muted">Store</span>}</td>
                    <td><span className={`badge badge-${item.status}`}>{item.status}</span></td>
                    <td className="text-muted text-sm text-mono">{new Date(item.created_at).toLocaleDateString()}</td>
                    {can(['owner', 'manager']) && (
                      <td>
                        <div className="flex gap-8">
                          <button className="btn btn-sm btn-ghost" onClick={() => openEdit(item)}>Edit</button>
                          {item.status === 'active' && (
                            <button className="btn btn-sm btn-ghost text-danger"
                              onClick={() => markStatus(item.id, 'expired')}>Expire</button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{modal === 'add' ? 'Add Item' : 'Edit Item'}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="form-grid">
              <div className="form-group full">
                <label>Title</label>
                <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Condition</label>
                <select className="input" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}>
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Category</label>
                <input className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Price</label>
                <input className="input" type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Barcode</label>
                <input className="input" value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Consignor (leave blank if store-owned)</label>
                <select className="input" value={form.consignor_id} onChange={e => setForm(f => ({ ...f, consignor_id: e.target.value }))}>
                  <option value="">Store-owned</option>
                  {consignors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Expiration Date</label>
                <input className="input" type="date" value={form.expiration_date} onChange={e => setForm(f => ({ ...f, expiration_date: e.target.value }))} />
              </div>
              <div className="form-group full">
                <label>Description</label>
                <textarea className="input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save Item</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
