import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../context/AuthContext';

// ─── STAFF ───────────────────────────────────────────────────────────────────
export function Staff() {
  const { show, Toast } = useToast();
  const [staff, setStaff] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'cashier' });

  const load = () => api.get('/users').then(r => setStaff(r.data)).catch(() => show('Failed to load.', 'error'));
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (modal === 'add') await api.post('/users', form);
      else await api.patch(`/users/${modal.id}`, form);
      show('Saved.', 'success'); setModal(null); load();
    } catch { show('Save failed.', 'error'); }
  };

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  return (
    <div className="main-content">
      {Toast}
      <div className="page-header">
        <h2>Staff</h2>
        <button className="btn btn-primary" onClick={() => { setForm({ name: '', email: '', password: '', role: 'cashier' }); setModal('add'); }}>+ Add Staff</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {staff.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td className="text-muted text-sm">{u.email}</td>
                  <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                  <td><span className={`badge ${u.active ? 'badge-active' : 'badge-expired'}`}>{u.active ? 'active' : 'inactive'}</span></td>
                  <td><button className="btn btn-sm btn-ghost" onClick={() => { setForm({ name: u.name, email: u.email, password: '', role: u.role, active: u.active }); setModal(u); }}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{modal === 'add' ? 'Add Staff' : 'Edit Staff'}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="form-grid cols-1">
              <div className="form-group"><label>Name</label><input className="input" value={form.name} onChange={f('name')} /></div>
              <div className="form-group"><label>Email</label><input className="input" value={form.email} onChange={f('email')} /></div>
              {modal === 'add' && <div className="form-group"><label>Password</label><input className="input" type="password" value={form.password} onChange={f('password')} /></div>}
              <div className="form-group"><label>Role</label>
                <select className="input" value={form.role} onChange={f('role')}>
                  <option value="cashier">Cashier</option>
                  <option value="manager">Manager</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TASKS ────────────────────────────────────────────────────────────────────
export function Tasks() {
  const { show, Toast } = useToast();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [staff, setStaff] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ assigned_to_user_id: '', title: '', notes: '', due_date: '' });

  const load = () => api.get('/tasks').then(r => setTasks(r.data)).catch(() => {});
  useEffect(() => { load(); api.get('/users').then(r => setStaff(r.data)).catch(() => {}); }, []);

  const add = async () => {
    try {
      await api.post('/tasks', form);
      show('Task added.', 'success'); setModal(false); load();
    } catch { show('Failed.', 'error'); }
  };

  const complete = async (id) => {
    await api.patch(`/tasks/${id}/complete`);
    load();
  };

  const del = async (id) => {
    await api.delete(`/tasks/${id}`);
    load();
  };

  const open = tasks.filter(t => !t.completed);
  const done = tasks.filter(t => t.completed);

  return (
    <div className="main-content">
      {Toast}
      <div className="page-header">
        <h2>Tasks</h2>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Add Task</button>
      </div>
      <div className="card">
        <div className="card-header"><h3>Open</h3><span className="text-muted text-sm text-mono">{open.length}</span></div>
        {open.length === 0 ? <div className="empty-state">No open tasks</div> : open.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <button className="btn btn-sm btn-ghost" onClick={() => complete(t.id)} title="Mark complete">✓</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{t.title}</div>
              <div className="text-sm text-muted">{t.assigned_to_name} · {t.due_date ? new Date(t.due_date).toLocaleDateString() : 'No due date'}</div>
              {t.notes && <div className="text-sm text-muted">{t.notes}</div>}
            </div>
            <button className="btn btn-sm btn-ghost text-danger" onClick={() => del(t.id)}>✕</button>
          </div>
        ))}
      </div>
      {done.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="text-muted">Completed</h3></div>
          {done.slice(0, 10).map(t => (
            <div key={t.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', opacity: 0.5, textDecoration: 'line-through' }}>
              <span className="text-sm">{t.title}</span>
            </div>
          ))}
        </div>
      )}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header"><h3>Add Task</h3><button className="btn btn-sm btn-ghost" onClick={() => setModal(false)}>✕</button></div>
            <div className="form-grid cols-1">
              <div className="form-group"><label>Title</label><input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
              <div className="form-group"><label>Assign To</label>
                <select className="input" value={form.assigned_to_user_id} onChange={e => setForm(p => ({ ...p, assigned_to_user_id: e.target.value }))}>
                  <option value="">— Select Staff —</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Due Date</label><input className="input" type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
              <div className="form-group"><label>Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={add}>Add Task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SCHEDULE ─────────────────────────────────────────────────────────────────
export function Schedule() {
  const { show, Toast } = useToast();
  const { can } = useAuth();
  const [shifts, setShifts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ user_id: '', shift_start: '', shift_end: '', notes: '' });

  const load = () => api.get('/schedules').then(r => setShifts(r.data)).catch(() => {});
  useEffect(() => { load(); api.get('/users').then(r => setStaff(r.data)).catch(() => {}); }, []);

  const add = async () => {
    try { await api.post('/schedules', form); show('Shift added.', 'success'); setModal(false); load(); }
    catch { show('Failed.', 'error'); }
  };

  const del = async (id) => { await api.delete(`/schedules/${id}`); load(); };

  return (
    <div className="main-content">
      {Toast}
      <div className="page-header">
        <h2>Schedule</h2>
        {can(['owner', 'manager']) && <button className="btn btn-primary" onClick={() => setModal(true)}>+ Add Shift</button>}
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Staff</th><th>Shift Start</th><th>Shift End</th><th>Notes</th>{can(['owner', 'manager']) && <th></th>}</tr></thead>
            <tbody>
              {shifts.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 500 }}>{s.staff_name}</td>
                  <td className="text-mono text-sm">{new Date(s.shift_start).toLocaleString()}</td>
                  <td className="text-mono text-sm">{new Date(s.shift_end).toLocaleString()}</td>
                  <td className="text-muted text-sm">{s.notes || '—'}</td>
                  {can(['owner', 'manager']) && <td><button className="btn btn-sm btn-ghost text-danger" onClick={() => del(s.id)}>Remove</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header"><h3>Add Shift</h3><button className="btn btn-sm btn-ghost" onClick={() => setModal(false)}>✕</button></div>
            <div className="form-grid cols-1">
              <div className="form-group"><label>Staff Member</label>
                <select className="input" value={form.user_id} onChange={e => setForm(p => ({ ...p, user_id: e.target.value }))}>
                  <option value="">— Select —</option>
                  {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Shift Start</label><input className="input" type="datetime-local" value={form.shift_start} onChange={e => setForm(p => ({ ...p, shift_start: e.target.value }))} /></div>
              <div className="form-group"><label>Shift End</label><input className="input" type="datetime-local" value={form.shift_end} onChange={e => setForm(p => ({ ...p, shift_end: e.target.value }))} /></div>
              <div className="form-group"><label>Notes</label><input className="input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={add}>Add Shift</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── TIME CLOCK ───────────────────────────────────────────────────────────────
export function TimeClock() {
  const { show, Toast } = useToast();
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [status, setStatus] = useState(null); // 'in' | 'out'

  const load = async () => {
    const res = await api.get('/timeclock');
    setEntries(res.data);
    const open = res.data.find(e => e.user_id === user.id && !e.clocked_out_at);
    setStatus(open ? 'in' : 'out');
  };
  useEffect(() => { load(); }, []);

  const clockIn = async () => {
    try { await api.post('/timeclock/in'); show('Clocked in.', 'success'); load(); }
    catch (err) { show(err.response?.data?.error || 'Failed.', 'error'); }
  };

  const clockOut = async () => {
    try { await api.post('/timeclock/out'); show('Clocked out.', 'success'); load(); }
    catch (err) { show(err.response?.data?.error || 'Failed.', 'error'); }
  };

  return (
    <div className="main-content">
      {Toast}
      <div className="page-header"><h2>Time Clock</h2></div>
      <div className="card" style={{ maxWidth: 400 }}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div className="stat-label">You are currently</div>
          <div style={{ fontFamily: 'var(--display)', fontSize: '2.5rem', color: status === 'in' ? 'var(--success)' : 'var(--text-muted)', margin: '8px 0' }}>
            {status === 'in' ? 'Clocked In' : 'Clocked Out'}
          </div>
          <button className={`btn btn-lg ${status === 'in' ? 'btn-danger' : 'btn-primary'}`}
            onClick={status === 'in' ? clockOut : clockIn}>
            {status === 'in' ? 'Clock Out' : 'Clock In'}
          </button>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><h3>Recent Entries</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Staff</th><th>Clocked In</th><th>Clocked Out</th><th>Hours</th></tr></thead>
            <tbody>
              {entries.slice(0, 30).map(e => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 500 }}>{e.staff_name}</td>
                  <td className="text-mono text-sm">{new Date(e.clocked_in_at).toLocaleString()}</td>
                  <td className="text-mono text-sm">{e.clocked_out_at ? new Date(e.clocked_out_at).toLocaleString() : <span className="badge badge-active">Active</span>}</td>
                  <td className="text-mono">{e.total_minutes ? `${(e.total_minutes / 60).toFixed(2)}h` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── REPORTS ──────────────────────────────────────────────────────────────────
export function Reports() {
  const { show, Toast } = useToast();
  const [tab, setTab] = useState('sales');
  const [groupBy, setGroupBy] = useState('day');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      let params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);

      switch (tab) {
        case 'sales':    params.append('group_by', groupBy); endpoint = `/reports/sales-summary?${params}`; break;
        case 'inventory': endpoint = `/reports/inventory?${params}`; break;
        case 'consignors': endpoint = `/reports/consignors?${params}`; break;
        case 'staff':    endpoint = `/reports/staff?${params}`; break;
        case 'bestsellers': params.append('limit', 20); endpoint = `/reports/best-sellers?${params}`; break;
        case 'payments': endpoint = `/reports/payment-methods?${params}`; break;
      }
      const res = await api.get(endpoint);
      setData(tab === 'inventory' ? res.data : res.data);
    } catch { show('Failed to load report.', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab, groupBy, from, to]);

  const exportCSV = () => {
    if (!data.length) return;
    const rows = Array.isArray(data) ? data : data.summary || [];
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => r[h] ?? '').join(','))].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `bjnhpos-${tab}-report.csv`;
    a.click();
  };

  const TABS = [['sales', 'Sales'], ['inventory', 'Inventory'], ['consignors', 'Consignors'], ['staff', 'Staff'], ['bestsellers', 'Best Sellers'], ['payments', 'Payments']];

  return (
    <div className="main-content">
      {Toast}
      <div className="page-header">
        <h2>Reports</h2>
        <button className="btn btn-secondary" onClick={exportCSV}>Export CSV</button>
      </div>

      <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
        {TABS.map(([key, label]) => (
          <button key={key} className={`btn ${tab === key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      <div className="card" style={{ padding: '14px 16px' }}>
        <div className="flex gap-8 items-center flex-wrap">
          <div className="form-group" style={{ margin: 0 }}>
            <label>From</label>
            <input className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 160 }} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>To</label>
            <input className="input" type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width: 160 }} />
          </div>
          {tab === 'sales' && (
            <div className="form-group" style={{ margin: 0 }}>
              <label>Group By</label>
              <select className="input" value={groupBy} onChange={e => setGroupBy(e.target.value)} style={{ width: 160 }}>
                <option value="hour">Hour of Day</option>
                <option value="day_of_week">Day of Week</option>
                <option value="day">Day</option>
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        {loading ? <div className="empty-state">Loading...</div> : (
          <div className="table-wrap">
            {tab === 'sales' && (
              <table>
                <thead><tr><th>Period</th><th>Transactions</th><th>Revenue</th><th>Avg Sale</th></tr></thead>
                <tbody>
                  {data.map((r, i) => (
                    <tr key={i}>
                      <td className="text-mono">{r.period}</td>
                      <td className="text-mono">{r.transaction_count}</td>
                      <td className="text-mono text-accent">${parseFloat(r.total_revenue || 0).toFixed(2)}</td>
                      <td className="text-mono text-muted">${parseFloat(r.avg_sale || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'inventory' && data.by_category && (
              <table>
                <thead><tr><th>Category</th><th>Active Items</th><th>Total Value</th></tr></thead>
                <tbody>
                  {data.by_category.map((r, i) => (
                    <tr key={i}>
                      <td>{r.category || 'Uncategorized'}</td>
                      <td className="text-mono">{r.count}</td>
                      <td className="text-mono text-accent">${parseFloat(r.total_value || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'consignors' && (
              <table>
                <thead><tr><th>Consignor</th><th>Active Items</th><th>Sold</th><th>Total Sold Value</th><th>Balance Owed</th><th>Total Paid Out</th></tr></thead>
                <tbody>
                  {data.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{r.name}</td>
                      <td className="text-mono">{r.active_items}</td>
                      <td className="text-mono">{r.sold_items}</td>
                      <td className="text-mono text-accent">${parseFloat(r.total_sold_value || 0).toFixed(2)}</td>
                      <td className="text-mono text-success">${parseFloat(r.balance || 0).toFixed(2)}</td>
                      <td className="text-mono text-muted">${parseFloat(r.total_paid_out || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'staff' && (
              <table>
                <thead><tr><th>Staff</th><th>Role</th><th>Sales</th><th>Revenue</th><th>Hours Worked</th></tr></thead>
                <tbody>
                  {data.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{r.name}</td>
                      <td><span className={`badge badge-${r.role}`}>{r.role}</span></td>
                      <td className="text-mono">{r.sales_count}</td>
                      <td className="text-mono text-accent">${parseFloat(r.total_revenue || 0).toFixed(2)}</td>
                      <td className="text-mono">{(r.total_minutes_worked / 60).toFixed(2)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'bestsellers' && (
              <table>
                <thead><tr><th>Title</th><th>Category</th><th>Times Sold</th><th>Revenue</th></tr></thead>
                <tbody>
                  {data.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{r.title}</td>
                      <td className="text-muted text-sm">{r.category || '—'}</td>
                      <td className="text-mono">{r.times_sold}</td>
                      <td className="text-mono text-accent">${parseFloat(r.total_revenue || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'payments' && (
              <table>
                <thead><tr><th>Method</th><th>Transactions</th><th>Total</th></tr></thead>
                <tbody>
                  {data.map((r, i) => (
                    <tr key={i}>
                      <td style={{ textTransform: 'capitalize' }}>{r.method.replace('_', ' ')}</td>
                      <td className="text-mono">{r.count}</td>
                      <td className="text-mono text-accent">${parseFloat(r.total || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
export function Activity() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/activity?limit=100').then(r => setEntries(r.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="main-content">
      <div className="page-header"><h2>Activity Log</h2></div>
      <div className="card">
        <div className="table-wrap">
          {loading ? <div className="empty-state">Loading...</div> : (
            <table>
              <thead><tr><th>Time</th><th>Staff</th><th>Action</th><th>Type</th><th>Details</th></tr></thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td className="text-mono text-sm text-muted">{new Date(e.created_at).toLocaleString()}</td>
                    <td style={{ fontWeight: 500 }}>{e.staff_name}</td>
                    <td className="text-mono text-sm">{e.action.replace(/_/g, ' ')}</td>
                    <td className="text-sm text-muted">{e.entity_type || '—'}</td>
                    <td className="text-sm text-muted">{e.details ? JSON.stringify(e.details).substring(0, 60) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
