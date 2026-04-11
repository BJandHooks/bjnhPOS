import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useToast } from '../hooks/useToast';

export default function Trades() {
  const { show, Toast } = useToast();
  const [trades, setTrades] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null);
  const [tradeItems, setTradeItems] = useState([]);
  const [bannedCustomers, setBannedCustomers] = useState([]);
  const [popularItems, setPopularItems] = useState([]);

  const CONDITIONS = ['mint', 'excellent', 'good', 'fair', 'poor'];

  const loadData = async () => {
    setLoading(true);
    try {
      const [tradesRes, cusRes, bannedRes, popularRes] = await Promise.all([
        api.get(`/trades${filterStatus ? `?status=${filterStatus}` : ''}`),
        api.get('/customers?limit=999'),
        api.get('/trades/banned-customers'),
        api.get('/trades/popular-items')
      ]);
      setTrades(tradesRes.data);
      setCustomers(cusRes.data);
      setBannedCustomers(bannedRes.data);
      setPopularItems(popularRes.data);
    } catch (err) {
      show('Failed to load data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filterStatus]);

  const openTradeDialog = () => {
    setTradeItems([{ title: '', description: '', condition: 'good', category: '' }]);
    setForm({ customer_id: '', items: [] });
    setModal('create');
  };

  const addTradeItem = () => {
    setTradeItems([...tradeItems, { title: '', description: '', condition: 'good', category: '' }]);
  };

  const removeTradeItem = (idx) => {
    setTradeItems(tradeItems.filter((_, i) => i !== idx));
  };

  const updateTradeItem = (idx, field, value) => {
    const items = [...tradeItems];
    items[idx][field] = value;
    setTradeItems(items);
  };

  const submitTrade = async () => {
    try {
      if (!form.customer_id) {
        show('Please select a customer.', 'error');
        return;
      }
      if (tradeItems.length === 0 || !tradeItems.every(i => i.title)) {
        show('Please add at least one item with a title.', 'error');
        return;
      }

      const tradeRes = await api.post('/trades', {
        customer_id: form.customer_id,
        items: tradeItems
      });

      const trade = tradeRes.data;
      setDetail(trade);
      setModal('evaluate');
    } catch (err) {
      show('Trade creation failed.', 'error');
    }
  };

  const acceptTrade = async (tradeId, method) => {
    try {
      await api.patch(`/trades/${tradeId}/accept`, { method });
      show('Trade accepted and customer credited.', 'success');
      loadData();
      setDetail(null);
      setModal(null);
    } catch (err) {
      show('Failed to accept trade.', 'error');
    }
  };

  const rejectTrade = async (tradeId) => {
    try {
      await api.patch(`/trades/${tradeId}/reject`, {});
      show('Trade rejected.', 'success');
      loadData();
      setDetail(null);
      setModal(null);
    } catch (err) {
      show('Failed to reject trade.', 'error');
    }
  };

  const banCustomer = async (customerId) => {
    const reason = prompt('Reason for banning customer:');
    if (!reason) return;

    try {
      await api.post(`/trades/ban-customer/${customerId}`, { reason });
      show('Customer banned from trading.', 'success');
      loadData();
    } catch (err) {
      show('Failed to ban customer.', 'error');
    }
  };

  const openDetail = async (trade) => {
    try {
      const res = await api.get(`/trades/${trade.id}`);
      setDetail(res.data);
    } catch {
      show('Failed to load trade details.', 'error');
    }
  };

  const getStatusBadge = (trade) => {
    if (trade.offer_accepted === true) return <span className="badge badge-success">Accepted</span>;
    if (trade.offer_accepted === false) return <span className="badge badge-danger">Rejected</span>;
    return <span className="badge badge-info">Pending</span>;
  };

  return (
    <div className="main-content">
      {Toast}
      <div className="page-header">
        <h2>Trading System</h2>
        <button className="btn btn-primary" onClick={openTradeDialog}>+ New Trade Evaluation</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div className="card">
          <div className="card-header"><h4>Recent Trades</h4></div>
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#059669' }}>{trades.length}</div>
            <div className="text-sm text-muted">Total trades</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h4>Banned Customers</h4></div>
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 'bold', color: '#dc2626' }}>{bannedCustomers.length}</div>
            <div className="text-sm text-muted">Banned from trading</div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h4>Top Trade Items</h4></div>
          <div style={{ padding: 16 }}>
            {popularItems.slice(0, 3).map((item, i) => (
              <div key={i} className="text-sm" style={{ marginBottom: 8 }}>
                <strong>{item.title}</strong>
                <div className="text-xs text-muted">{item.trade_count}x traded</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <label style={{ marginRight: 12, display: 'inline-block' }}>Filter by status:</label>
            <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ maxWidth: 200, display: 'inline-block' }}>
              <option value="">All Trades</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <span className="text-muted text-sm">{trades.length} trades</span>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div className="empty-state">Loading...</div>
          ) : trades.length === 0 ? (
            <div className="empty-state">No trades found</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Offer Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {trades.map(t => (
                  <tr key={t.id}>
                    <td className="text-mono text-sm">{t.id.substring(0, 8)}</td>
                    <td style={{ fontWeight: 500 }}>{t.customer_name || '—'}</td>
                    <td className="text-mono">{t.total_items}</td>
                    <td className="text-mono">${parseFloat(t.offer_amount).toFixed(2)}</td>
                    <td>{getStatusBadge(t)}</td>
                    <td className="text-sm text-muted">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td>
                      <button className="btn btn-sm btn-ghost" onClick={() => openDetail(t)}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Trade evaluation modal */}
      {modal === 'create' && form && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h3>Evaluate Trade-In</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="form-grid cols-1">
                <div className="form-group">
                  <label>Customer*</label>
                  <select className="input" value={form.customer_id}
                    onChange={e => setForm({ ...form, customer_id: e.target.value })}>
                    <option value="">Select customer...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ backgroundColor: '#f3f4f6', padding: 16, borderRadius: 4, marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h4>Items to Trade In</h4>
                    <button className="btn btn-sm btn-primary" onClick={addTradeItem}>+ Add Item</button>
                  </div>

                  {tradeItems.map((item, idx) => (
                    <div key={idx} style={{ backgroundColor: 'white', padding: 12, borderRadius: 4, marginBottom: 12, position: 'relative' }}>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => removeTradeItem(idx)}
                        style={{ position: 'absolute', top: 8, right: 8 }}>✕</button>

                      <div className="form-grid cols-2" style={{ marginBottom: 8 }}>
                        <input className="input" placeholder="Title" value={item.title}
                          onChange={e => updateTradeItem(idx, 'title', e.target.value)} />
                        <select className="input" value={item.condition}
                          onChange={e => updateTradeItem(idx, 'condition', e.target.value)}>
                          {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>

                      <input className="input" placeholder="Category (optional)" value={item.category}
                        onChange={e => updateTradeItem(idx, 'category', e.target.value)} 
                        style={{ marginBottom: 8 }} />

                      <textarea className="input" rows={2} placeholder="Description (optional)" value={item.description}
                        onChange={e => updateTradeItem(idx, 'description', e.target.value )} />
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={submitTrade}>Evaluate Offer</button>
                  <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trade evaluation result modal */}
      {modal === 'evaluate' && detail && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>Trade Offer Evaluation</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="form-grid cols-2">
                <div className="form-group">
                  <label>Total Items</label>
                  <div className="text-mono text-lg" style={{ fontWeight: 'bold' }}>{detail.total_items}</div>
                </div>
                <div className="form-group">
                  <label>Items Evaluated</label>
                  <div className="text-mono text-lg" style={{ fontWeight: 'bold' }}>{detail.items_evaluated}</div>
                </div>
                <div className="form-group cols-2">
                  <label>Offer Amount</label>
                  <div style={{ fontSize: 28, fontWeight: 'bold', color: '#059669' }}>
                    ${parseFloat(detail.offer_amount).toFixed(2)}
                  </div>
                </div>
              </div>

              {detail.fraud_flags && detail.fraud_flags.length > 0 && (
                <div style={{ marginTop: 16, padding: 12, backgroundColor: '#fef3c7', borderRadius: 4, borderLeft: '4px solid #f59e0b' }}>
                  <strong className="text-sm">Fraud Alerts</strong>
                  {detail.fraud_flags.map((flag, i) => (
                    <div key={i} className="text-sm" style={{ marginTop: 8 }}>
                      <span className="badge badge-warning">{flag.flag_type.replace(/_/g, ' ')}</span>
                      <div className="text-xs text-muted" style={{ marginTop: 4 }}>{flag.description}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f9fafb', borderRadius: 4 }}>
                <h4 className="text-sm" style={{ marginBottom: 12 }}>Items</h4>
                {detail.items && detail.items.map((item, i) => (
                  <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < detail.items.length - 1 ? '1px solid #e5e7eb' : 'none' }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <strong className="text-sm">{item.title}</strong>
                        <div className="text-xs text-muted">Condition: {item.condition}</div>
                        {item.is_duplicate && <div className="text-xs" style={{ color: '#dc2626' }}>⚠ Duplicate in stock</div>}
                      </div>
                      <div className="text-mono text-sm" style={{ textAlign: 'right' }}>
                        ${parseFloat(item.estimated_value || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-success" onClick={() => { acceptTrade(detail.id, 'store_credit'); }}>
                  Accept as Store Credit
                </button>
                <button className="btn btn-info" onClick={() => { acceptTrade(detail.id, 'cash'); }}>
                  Accept as Cash
                </button>
                <button className="btn btn-ghost" onClick={() => { rejectTrade(detail.id); }}>
                  Reject Offer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trade detail modal */}
      {detail && modal !== 'evaluate' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>Trade {detail.id.substring(0, 8)}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid cols-2">
                <div className="form-group">
                  <label>Status</label>
                  <div>{getStatusBadge(detail)}</div>
                </div>
                <div className="form-group">
                  <label>Offer Amount</label>
                  <div className="text-mono">${parseFloat(detail.offer_amount).toFixed(2)}</div>
                </div>
                <div className="form-group">
                  <label>Items</label>
                  <div className="text-mono">{detail.total_items}</div>
                </div>
                <div className="form-group">
                  <label>Evaluated</label>
                  <div className="text-mono">{detail.items_evaluated}</div>
                </div>
              </div>

              {detail.items && detail.items.length > 0 && (
                <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f9fafb', borderRadius: 4 }}>
                  <h4 className="text-sm">Items</h4>
                  {detail.items.map((item, i) => (
                    <div key={i} style={{ marginTop: 8, fontSize: 13 }}>
                      <strong>{item.title}</strong>
                      <div className="text-xs text-muted">{item.condition}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
