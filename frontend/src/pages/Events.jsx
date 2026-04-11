import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useToast } from '../hooks/useToast';

const EVENT_TYPES = ['off_site', 'in_store_class', 'in_store_performance', 'workshop', 'recurring'];
const RECURRING_PATTERNS = ['daily', 'weekly', 'biweekly', 'monthly'];

export default function Events() {
  const { show, Toast } = useToast();
  const [events, setEvents] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('scheduled');

  const BLANK_FORM = {
    title: '',
    description: '',
    event_type: 'in_store_class',
    start_date: '',
    end_date: '',
    location: '',
    capacity: '',
    price: 0,
    is_free: false,
    is_recurring: false,
    recurring_pattern: 'weekly',
    recurring_end_date: '',
    host_id: '',
    performer_id: '',
    revenue_splits: []
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [eventsRes, cusRes] = await Promise.all([
        api.get(`/events?status=${filterStatus}${filterType ? `&type=${filterType}` : ''}`),
        api.get('/customers?limit=999')
      ]);
      setEvents(eventsRes.data);
      setCustomers(cusRes.data);
    } catch {
      show('Failed to load data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [filterType, filterStatus]);

  const openCreate = () => {
    setForm(BLANK_FORM);
    setModal('create');
  };

  const openEdit = (event) => {
    setForm({
      title: event.title,
      description: event.description || '',
      event_type: event.event_type,
      start_date: event.start_date.split('T')[0],
      end_date: event.end_date ? event.end_date.split('T')[0] : '',
      location: event.location || '',
      capacity: event.capacity || '',
      price: event.price || 0,
      is_free: event.is_free || false,
      is_recurring: event.is_recurring || false,
      recurring_pattern: event.recurring_pattern || 'weekly',
      recurring_end_date: event.recurring_end_date || '',
      host_id: event.host_id || '',
      performer_id: event.performer_id || '',
      revenue_splits: []
    });
    setModal(event);
  };

  const saveEvent = async () => {
    try {
      if (!form.title || !form.start_date) {
        show('Title and start date are required.', 'error');
        return;
      }

      if (modal === 'create') {
        await api.post('/events', form);
        show('Event created.', 'success');
      } else {
        await api.patch(`/events/${modal.id}`, form);
        show('Event updated.', 'success');
      }
      setModal(null);
      loadData();
    } catch {
      show('Save failed.', 'error');
    }
  };

  const openDetail = async (event) => {
    try {
      const res = await api.get(`/events/${event.id}`);
      setDetail(res.data);
    } catch {
      show('Failed to load event details.', 'error');
    }
  };

  const registerCustomer = async (eventId, customerId, regType) => {
    try {
      await api.post(`/events/${eventId}/register`, {
        customer_id: customerId,
        registration_type: regType
      });
      show('Customer registered.', 'success');
      openDetail(events.find(e => e.id === eventId));
    } catch {
      show('Registration failed.', 'error');
    }
  };

  const checkIn = async (eventId, regId) => {
    try {
      await api.post(`/events/${eventId}/check-in/${regId}`, {});
      show('Checked in.', 'success');
      openDetail(events.find(e => e.id === eventId));
    } catch {
      show('Check-in failed.', 'error');
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      scheduled: 'badge-info',
      completed: 'badge-success',
      cancelled: 'badge-danger'
    };
    return colors[status] || 'badge-default';
  };

  return (
    <div className="main-content">
      {Toast}
      <div className="page-header">
        <h2>Events & Calendar</h2>
        <button className="btn btn-primary" onClick={openCreate}>+ Create Event</button>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', gap: 12 }}>
            <select className="input" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="">All Types</option>
              {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
            <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ maxWidth: 150 }}>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <span className="text-muted text-sm">{events.length} events</span>
        </div>

        <div className="table-wrap">
          {loading ? (
            <div className="empty-state">Loading...</div>
          ) : events.length === 0 ? (
            <div className="empty-state">No events found</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Attendees</th>
                  <th>Capacity</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {events.map(e => {
                  const attendees = e.reserved_spots_sold + e.door_registrations;
                  return (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 500 }}>{e.title}</td>
                      <td className="text-sm">{e.event_type.replace(/_/g, ' ')}</td>
                      <td className="text-sm text-muted">{new Date(e.start_date).toLocaleDateString()}</td>
                      <td className="text-mono">{attendees}</td>
                      <td className="text-mono text-muted">{e.capacity || '—'}</td>
                      <td className="text-mono">${parseFloat(e.price || 0).toFixed(2)}</td>
                      <td><span className={`badge ${getStatusBadge(e.status)}`}>{e.status}</span></td>
                      <td>
                        <button className="btn btn-sm btn-ghost" onClick={() => openDetail(e)}>View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create/Edit modal */}
      {form && modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>{modal === 'create' ? 'Create Event' : 'Edit Event'}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="form-grid cols-1">
                <div className="form-group">
                  <label>Title*</label>
                  <input className="input" value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Type*</label>
                  <select className="input" value={form.event_type}
                    onChange={e => setForm({ ...form, event_type: e.target.value })}>
                    {EVENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>

                <div className="form-grid cols-2">
                  <div className="form-group">
                    <label>Start Date*</label>
                    <input type="datetime-local" className="input" value={form.start_date}
                      onChange={e => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>End Date</label>
                    <input type="datetime-local" className="input" value={form.end_date}
                      onChange={e => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Location</label>
                  <input className="input" value={form.location}
                    onChange={e => setForm({ ...form, location: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea className="input" rows={3} value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>

                <div className="form-grid cols-2">
                  <div className="form-group">
                    <label>Capacity</label>
                    <input type="number" className="input" value={form.capacity}
                      onChange={e => setForm({ ...form, capacity: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>
                      <input type="checkbox" checked={form.is_free}
                        onChange={e => setForm({ ...form, is_free: e.target.checked })} />
                      Free Event
                    </label>
                  </div>
                </div>

                {!form.is_free && (
                  <div className="form-group">
                    <label>Price</label>
                    <input type="number" className="input" step="0.01" value={form.price}
                      onChange={e => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
                  </div>
                )}

                <div className="form-group">
                  <label>
                    <input type="checkbox" checked={form.is_recurring}
                      onChange={e => setForm({ ...form, is_recurring: e.target.checked })} />
                    Recurring Event
                  </label>
                </div>

                {form.is_recurring && (
                  <div className="form-grid cols-2">
                    <div className="form-group">
                      <label>Pattern</label>
                      <select className="input" value={form.recurring_pattern}
                        onChange={e => setForm({ ...form, recurring_pattern: e.target.value })}>
                        {RECURRING_PATTERNS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>End Date</label>
                      <input type="date" className="input" value={form.recurring_end_date}
                        onChange={e => setForm({ ...form, recurring_end_date: e.target.value })} />
                    </div>
                  </div>
                )}

                <div className="form-grid cols-2">
                  <div className="form-group">
                    <label>Host/Organizer</label>
                    <select className="input" value={form.host_id}
                      onChange={e => setForm({ ...form, host_id: e.target.value })}>
                      <option value="">None</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Performer</label>
                    <select className="input" value={form.performer_id}
                      onChange={e => setForm({ ...form, performer_id: e.target.value })}>
                      <option value="">None</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={saveEvent}>Save Event</button>
                  <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div className="modal" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h3>{detail.title}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="form-grid cols-2">
                <div className="form-group">
                  <label>Type</label>
                  <div>{detail.event_type.replace(/_/g, ' ')}</div>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <div><span className={`badge ${getStatusBadge(detail.status)}`}>{detail.status}</span></div>
                </div>
                <div className="form-group cols-2">
                  <label>Date</label>
                  <div>{new Date(detail.start_date).toLocaleString()}</div>
                </div>
                <div className="form-group">
                  <label>Location</label>
                  <div>{detail.location || '—'}</div>
                </div>
                <div className="form-group">
                  <label>Price</label>
                  <div>{detail.is_free ? 'Free' : '$' + parseFloat(detail.price || 0).toFixed(2)}</div>
                </div>
                <div className="form-group">
                  <label>Capacity</label>
                  <div>{detail.capacity || 'Unlimited'}</div>
                </div>
              </div>

              {detail.description && (
                <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f9fafb', borderRadius: 4 }}>
                  <h4 className="text-sm">Description</h4>
                  <div className="text-sm" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{detail.description}</div>
                </div>
              )}

              {detail.registrations && detail.registrations.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <h4 className="text-sm" style={{ marginBottom: 12 }}>Registrations ({detail.registrations.length})</h4>
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {detail.registrations.map(reg => (
                      <div key={reg.id} style={{ padding: 8, backgroundColor: '#f9fafb', borderRadius: 4, marginBottom: 8 }}>
                        <div className="flex justify-between items-center">
                          <strong className="text-sm">{reg.customer_name}</strong>
                          <span className="text-xs badge" style={{ marginLeft: 8 }}>
                            {reg.registration_type} {reg.checked_in ? '✓' : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detail.linked_sales && detail.linked_sales.length > 0 && (
                <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f0fdf4', borderRadius: 4 }}>
                  <h4 className="text-sm">Linked Sales: ${detail.linked_sales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0).toFixed(2)}</h4>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
