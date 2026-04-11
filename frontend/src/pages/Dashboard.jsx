import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

function fmt$(n) {
  return '$' + (parseFloat(n) || 0).toFixed(2).replace(/\B(?=(\d{3})+(?\!\d))/g, ',');
}

function fmtDate(d) {
  if (\!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtTime(d) {
  if (\!d) return '';
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function daysUntil(dt) {
  const diff = new Date(dt) - Date.now();
  const d = Math.ceil(diff / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d < 0) return Math.abs(d) + 'd ago';
  return 'In ' + d + 'd';
}

function isOverdue(dt) { return dt && new Date(dt) < new Date(); }

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="card" style={{ padding: '20px 22px', borderTop: '3px solid ' + (accent || '#059669') }}>
      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshed, setRefreshed] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/dashboard');
      setData(res.data);
      setError('');
      setRefreshed(new Date());
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) return (
    <div className="main-content" style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight: 300 }}>
      <div style={{ textAlign:'center', color:'#6b7280' }}>Loading dashboard…</div>
    </div>
  );

  if (error) return (
    <div className="main-content">
      <div className="card" style={{ padding: 24, textAlign:'center', color:'#dc2626' }}>
        <strong>Error:</strong> {error}
        <br />
        <button className="btn btn-sm btn-ghost" style={{ marginTop: 12 }} onClick={load}>Retry</button>
      </div>
    </div>
  );

  const {
    daily_total = 0, transaction_count = 0, avg_sale_value = 0,
    recent_sales = [], upcoming_events = [], open_tasks = [], week_trend = [],
  } = data || {};

  const trendTotal = week_trend.reduce((s, d) => s + (parseFloat(d.day_total) || 0), 0);
  const maxTrend = Math.max(...week_trend.map(d => parseFloat(d.day_total) || 0), 1);
  const overdueCount = open_tasks.filter(t => isOverdue(t.due_date)).length;

  return (
    <div className="main-content">
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0 }}>Dashboard</h2>
          <span className="text-sm text-muted">
            {new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
          </span>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={load}>
          ↺ Refresh
          {refreshed && (
            <span style={{ marginLeft: 6, fontSize: 11, color:'#9ca3af' }}>
              {fmtTime(refreshed)}
            </span>
          )}
        </button>
      </div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard label="Today's Sales"  value={fmt$(daily_total)}
          sub={transaction_count + ' transaction' + (transaction_count \!== 1 ? 's' : '')} accent="#059669" />
        <StatCard label="Avg Sale"       value={fmt$(avg_sale_value)}  sub="per transaction"  accent="#2563eb" />
        <StatCard label="7-Day Revenue"  value={fmt$(trendTotal)}
          sub={week_trend.length + ' day' + (week_trend.length \!== 1 ? 's' : '') + ' with sales'} accent="#7c3aed" />
        <StatCard label="Open Tasks"     value={open_tasks.length}
          sub={overdueCount > 0 ? overdueCount + ' overdue' : 'None overdue'}
          accent={overdueCount > 0 ? '#dc2626' : '#f59e0b'} />
      </div>

      {/* Main grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 330px', gap: 20, alignItems:'start' }}>

        {/* Recent Sales */}
        <div className="card">
          <div style={{ padding:'14px 18px 10px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <h3 style={{ margin:0, fontSize:15, fontWeight:600 }}>Recent Sales</h3>
            <button className="btn btn-sm btn-ghost" style={{ fontSize:12 }} onClick={() => navigate('/reports')}>
              View reports →
            </button>
          </div>
          {recent_sales.length === 0 ? (
            <div className="empty-state" style={{ padding:'28px 18px' }}>No sales recorded today</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Customer</th>
                    <th>Staff</th>
                    <th style={{ textAlign:'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recent_sales.map(s => (
                    <tr key={s.id}>
                      <td className="text-sm text-muted">{fmtTime(s.created_at)}</td>
                      <td style={{ fontWeight:500 }}>{s.customer_name}</td>
                      <td className="text-sm text-muted">{s.staff_name || '—'}</td>
                      <td style={{ textAlign:'right', fontWeight:600, fontFamily:'monospace' }}>{fmt$(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ display:'flex', flexDirection:'column', gap: 18 }}>

          {/* Upcoming Events */}
          <div className="card" style={{ padding:'14px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
              <h3 style={{ margin:0, fontSize:15, fontWeight:600 }}>Upcoming Events</h3>
              <button className="btn btn-sm btn-ghost" style={{ fontSize:12 }} onClick={() => navigate('/events')}>
                All events →
              </button>
            </div>
            {upcoming_events.length === 0 ? (
              <div className="text-sm text-muted">No upcoming events</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap: 10 }}>
                {upcoming_events.map(ev => (
                  <div
                    key={ev.id}
                    onClick={() => navigate('/events')}
                    style={{
                      padding:'10px 12px', borderRadius:6, border:'1px solid #e5e7eb',
                      background:'#f9fafb', cursor:'pointer',
                    }}
                  >
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:4 }}>
                      <span style={{ fontWeight:600, fontSize:13, color:'#111827' }}>{ev.title}</span>
                      <span style={{
                        fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:10,
                        background: ev.status === 'active' ? '#d1fae5' : '#dbeafe',
                        color: ev.status === 'active' ? '#065f46' : '#1d4ed8',
                        textTransform:'uppercase', whiteSpace:'nowrap',
                      }}>
                        {ev.status}
                      </span>
                    </div>
                    <div style={{ fontSize:12, color:'#6b7280', display:'flex', gap:8 }}>
                      <span>{fmtDate(ev.start_date)}</span>
                      <span style={{ color:'#059669', fontWeight:500 }}>· {daysUntil(ev.start_date)}</span>
                    </div>
                    {ev.location && <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>📍 {ev.location}</div>}
                    <div style={{ fontSize:11, color:'#9ca3af', marginTop:2, textTransform:'capitalize' }}>
                      {ev.event_type}{ev.is_free ? ' · Free' : (ev.price > 0 ? ` · ${fmt$(ev.price)}` : '')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Open Tasks */}
          <div className="card" style={{ padding:'14px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 12 }}>
              <h3 style={{ margin:0, fontSize:15, fontWeight:600 }}>Open Tasks</h3>
              <button className="btn btn-sm btn-ghost" style={{ fontSize:12 }} onClick={() => navigate('/tasks')}>
                All tasks →
              </button>
            </div>
            {open_tasks.length === 0 ? (
              <div className="text-sm text-muted">All caught up — no open tasks</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap: 8 }}>
                {open_tasks.map(t => {
                  const od = isOverdue(t.due_date);
                  return (
                    <div
                      key={t.id}
                      onClick={() => navigate('/tasks')}
                      style={{
                        padding:'8px 10px', borderRadius:6, cursor:'pointer',
                        background: od ? '#fff7f7' : '#f9fafb',
                        border: '1px solid ' + (od ? '#fecaca' : '#e5e7eb'),
                      }}
                    >
                      <div style={{ fontSize:13, fontWeight:500, color: od ? '#dc2626' : '#111827' }}>{t.title}</div>
                      <div style={{ fontSize:11, color:'#9ca3af', marginTop:2, display:'flex', gap:8 }}>
                        {t.assigned_to_name && <span>→ {t.assigned_to_name}</span>}
                        {t.due_date && (
                          <span style={{ color: od ? '#dc2626' : '#6b7280' }}>
                            {od ? '⚠ Overdue: ' : 'Due: '}{fmtDate(t.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Inquiries placeholder */}
          <div className="card" style={{ padding:'14px 18px', opacity:0.55 }}>
            <div style={{ fontSize:13, fontWeight:600, color:'#374151', marginBottom:4 }}>
              Inquiries <span style={{ fontSize:11, fontWeight:400, color:'#9ca3af' }}>(coming soon)</span>
            </div>
            <div className="text-sm text-muted">Customer inquiry intake will appear here once enabled.</div>
          </div>
        </div>
      </div>

      {/* 7-Day Trend */}
      {week_trend.length > 0 && (
        <div className="card" style={{ marginTop: 20, padding:'16px 20px' }}>
          <h3 style={{ margin:'0 0 14px', fontSize:15, fontWeight:600, color:'#374151' }}>7-Day Sales Trend</h3>
          <div style={{ display:'flex', gap:8, alignItems:'flex-end', flexWrap:'wrap' }}>
            {week_trend.map((day, i) => {
              const val = parseFloat(day.day_total) || 0;
              const h = Math.max((val / maxTrend) * 80, 4);
              return (
                <div key={i} style={{ flex:1, minWidth:44, textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'#059669', fontWeight:600, marginBottom:3 }}>{fmt$(val)}</div>
                  <div style={{ height: h + 'px', background:'#059669', borderRadius:'3px 3px 0 0', opacity:0.72, minHeight:4 }} />
                  <div style={{ fontSize:10, color:'#9ca3af', marginTop:3 }}>
                    {new Date(day.sale_date).toLocaleDateString('en-US', { weekday:'short', month:'numeric', day:'numeric' })}
                  </div>
                  <div style={{ fontSize:10, color:'#6b7280' }}>{day.day_count} sale{day.day_count \!== 1 ? 's' : ''}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
