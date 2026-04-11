import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useToast } from '../hooks/useToast';

const STATUS_OPTIONS = ['received', 'in_progress', 'ready', 'picked_up'];
const JOB_TYPE_OPTIONS = ['repair', 'custom_work'];

export default function WorkOrders() {
  const { show, Toast } = useToast();
  const [workOrders, setWorkOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null);

  const BLANK_FORM = {
    customer_id: '',
    job_type: 'repair',
    description: '',
    deposit_collected: 0,
    deposit_method: null,
    estimated_completion_date: '',
    notes: '',
    items: []
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [woRes, cusRes, staffRes] = await Promise.all([
        api.get(`/work-orders${filterStatus ? `?status=${filterStatus}` : ''}`),
        api.get('/customers?limit=999'),
        api.get('/users')
      ]);
      setWorkOrders(woRes.data);
      setCustomers(cusRes.data);
      setStaff(staffRes.data);
    } catch (err) {
      show('Failed to load data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filterStatus]);

  const openDetail = async (wo) => {
    try {
      const res = await api.get(`/work-orders/${wo.id}`);
      setDetail(res.data);
    } catch {
      show('Failed to load work order details.', 'error');
    }
  };

  const openCreate = () => {
    setForm(BLANK_FORM);
    setModal('create');
  };

  const openEdit = (wo) => {
    setForm({
      customer_id: wo.customer_id,
      job_type: wo.job_type,
      description: wo.description,
      deposit_collected: wo.deposit_collected,
      deposit_method: wo.deposit_method,
      estimated_completion_date: wo.estimated_completion_date || '',
      notes: wo.notes || '',
      items: []
    });
    setModal(wo);
  };

  const saveWorkOrder = async () => {
    try {
      if (!form.customer_id) {
        show('Please select a customer.', 'error');
        return;
      }
      if (!form.description) {
        show('Please enter a description.', 'error');
        return;
      }

      if (modal === 'create') {
        await api.post('/work-orders', form);
        show('Work order created.', 'success');
      } else {
        await api.patch(`/work-orders/${modal.id}`, form);
        show('Work order updated.', 'success');
      }
      setModal(null);
      loadData();
    } catch (err) {
      show('Save failed.', 'error');
    }
  };

  const updateStatus = async (woId, newStatus) => {
    try {
      await api.patch(`/work-orders/${woId}`, { status: newStatus });
      show('Status updated.', 'success');
      loadData();
    } catch {
      show('Failed to update status.', 'error');
    }
  };

  const markReady = async (woId) => {
    try {
      await api.post(`/work-orders/${woId}/mark-ready`, {
        send_notification: true,
        method: 'email'
      });
      show('Work order marked as ready and customer notified.', 'success');
      loadData();
    } catch {
      show('Failed to mark as ready.', 'error');
    }
  };

  const pickUp = async (woId) => {
    try {
      await api.post(`/work-orders/${woId}/pickup`, {});
      show('Work order marked as picked up.', 'success');
      loadData();
    } catch {
      show('Failed to mark pickup.', 'error');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      received: 'badge-info',
      in_progress: 'badge-warning',
      ready: 'badge-success',
      picked_up: 'badge-secondary'
    };
    return colors[status] || 'badge-default';
  };

  return (
    <div className="main-content">
      {Toast}
      <div className="page-header">
        <h2>Work Orders</h2>
        <button className="btn btn-primary" onClick={openCreate}>+ Create Work Order</button>
      </div>

      <div className="card">
        <div className="card-header">
          <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <span className="text-muted text-sm text-mono">{workOrders.length} work orders</span>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div className="empty-state">Loading...</div>
          ) : workOrders.length === 0 ? (
            <div className="empty-state">No work orders found</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Deposit</th>
                  <th>Est. Completion</th>
                  <th>Assigned To</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map(wo => (
                  <tr key={wo.id}>
                    <td className="text-mono text-sm">{wo.id.substring(0, 8)}</td>
                    <td style={{ fontWeight: 500 }}>{wo.customer_name || '—'}</td>
                    <td className="text-sm">{wo.job_type.replace(/_/g, ' ')}</td>
                    <td><span className={`badge ${getStatusColor(wo.status)}`}>{wo.status.replace(/_/g, ' ')}</span></td>
                    <td className="text-mono">${parseFloat(wo.deposit_collected).toFixed(2)}</td>
                    <td className="text-sm text-muted">{wo.estimated_completion_date ? new Date(wo.estimated_completion_date).toLocaleDateString() : '—'}</td>
                    <td className="text-sm text-muted">{wo.assigned_to_name || '—'}</td>
                    <td>
                      <div className="flex gap-8">
                        <button className="btn btn-sm btn-ghost" onClick={() => openDetail(wo)}>View</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => openEdit(wo)}>Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>Work Order {detail.id.substring(0, 8)}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="form-grid cols-2">
                <div className="form-group">
                  <label>Customer</label>
                  <div className="text-mono">{detail.customer_name}</div>
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <div>{detail.job_type.replace(/_/g, ' ')}</div>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <div><span className={`badge ${getStatusColor(detail.status)}`}>{detail.status.replace(/_/g, ' ')}</span></div>
                </div>
                <div className="form-group">
                  <label>Assigned To</label>
                  <div>{detail.assigned_to_name || 'Unassigned'}</div>
                </div>
                <div className="form-group cols-2">
                  <label>Description</label>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{detail.description}</div>
                </div>
                {detail.notes && (
                  <div className="form-group cols-2">
                    <label>Notes</label>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{detail.notes}</div>
                  </div>
                )}
                <div className="form-group">
                  <label>Deposit Collected</label>
                  <div className="text-mono">${parseFloat(detail.deposit_collected).toFixed(2)}</div>
                </div>
                <div className="form-group">
                  <label>Est. Completion</label>
                  <div>{detail.estimated_completion_date ? new Date(detail.estimated_completion_date).toLocaleDateString() : '—'}</div>
                </div>
              </div>

              {detail.items && detail.items.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h4>Items</h4>
                  <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: 4 }}>
                    {detail.items.map(item => (
                      <div key={item.id} style={{ marginBottom: 8 }}>
                        <span className="text-mono text-sm">{item.quantity}x</span> {item.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.timeline && detail.timeline.length > 0 && (
                <div style={{ marginTop: 24 }}>
                  <h4>Timeline</h4>
                  <div style={{ padding: '16px', backgroundColor: '#f9fafb', borderRadius: 4 }}>
                    {detail.timeline.map(event => (
                      <div key={event.id} style={{ marginBottom: 12, borderBottom: '1px solid #e5e7eb', paddingBottom: 12 }}>
                        <div className="flex justify-between items-center">
                          <strong className="text-sm">{event.status_change.replace(/_/g, ' ')}</strong>
                          <span className="text-xs text-muted">{new Date(event.created_at).toLocaleString()}</span>
                        </div>
                        {event.notes && <div className="text-sm text-muted" style={{ marginTop: 4 }}>{event.notes}</div>}
                        {event.user_name && <div className="text-xs text-muted">by {event.user_name}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.status !== 'picked_up' && (
                <div style={{ marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {detail.status === 'in_progress' && (
                    <button className="btn btn-sm btn-success" onClick={() => { markReady(detail.id); setDetail(null); }}>
                      Mark as Ready
                    </button>
                  )}
                  {detail.status === 'ready' && (
                    <button className="btn btn-sm btn-success" onClick={() => { pickUp(detail.id); setDetail(null); }}>
                      Mark as Picked Up
                    </button>
                  )}
                  {['received', 'in_progress'].includes(detail.status) && (
                    <>
                      <button className="btn btn-sm btn-warning" onClick={() => { updateStatus(detail.id, 'in_progress'); setDetail(null); }}>
                        Start Work
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit modal */}
      {form && modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>{modal === 'create' ? 'Create Work Order' : 'Edit Work Order'}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="form-grid cols-1">
              <div className="form-group">
                <label>Customer*</label>
                <select className="input" value={form.customer_id} 
                  onChange={e => setForm({ ...form, customer_id: e.target.value })}>
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Job Type*</label>
                <select className="input" value={form.job_type}
                  onChange={e => setForm({ ...form, job_type: e.target.value })}>
                  {JOB_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Description*</label>
                <textarea className="input" rows={3} value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="What needs to be done?"></textarea>
              </div>

              <div className="form-group">
                <label>Deposit Collected</label>
                <input type="number" className="input" step="0.01" value={form.deposit_collected}
                  onChange={e => setForm({ ...form, deposit_collected: parseFloat(e.target.value) || 0 })} />
              </div>

              {form.deposit_collected > 0 && (
                <div className="form-group">
                  <label>Deposit Method</label>
                  <select className="input" value={form.deposit_method || ''}
                    onChange={e => setForm({ ...form, deposit_method: e.target.value || null })}>
                    <option value="">Select method...</option>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="store_credit">Store Credit</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Est. Completion Date</label>
                <input type="date" className="input" value={form.estimated_completion_date}
                  onChange={e => setForm({ ...form, estimated_completion_date: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Notes</label>
                <textarea className="input" rows={2} value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any additional notes..."></textarea>
              </div>

              <div className="form-group" style={{ marginTop: 16 }}>
                <button className="btn btn-primary" onClick={saveWorkOrder}>Save</button>
                <button className="btn btn-ghost" onClick={() => setModal(null)} style={{ marginLeft: 8 }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
