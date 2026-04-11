import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'sales', label: 'Sales & Velocity' },
  { key: 'customers', label: 'Customers' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'seasonal', label: 'Seasonal & YoY' },
  { key: 'theft', label: 'Theft Prevention' },
];

function StatCard({ label, value, sub }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #ddd', borderRadius:8, padding:'16px 20px', minWidth:160 }}>
      <div style={{ fontSize:13, color:'#888', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:700, color:'#1a1a2e' }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize:12, color:'#aaa', marginTop:2 }}>{sub}</div>}
    </div>
  );
}

function Table({ columns, rows }) {
  if (!rows || rows.length === 0) return <div style={{ color:'#aaa', padding:'20px 0' }}>No data</div>;
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
        <thead>
          <tr style={{ background:'#f5f5f5' }}>
            {columns.map(c => <th key={c.key} style={{ padding:'8px 12px', textAlign:'left', borderBottom:'2px solid #eee', whiteSpace:'nowrap' }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom:'1px solid #f0f0f0' }}>
              {columns.map(c => <td key={c.key} style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>{c.render ? c.render(row) : (row[c.key] ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DateRange({ start, end, onChange }) {
  return (
    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:20 }}>
      <label style={{ fontSize:13, color:'#666' }}>From</label>
      <input type="date" value={start} onChange={e => onChange('start', e.target.value)} style={{ padding:'6px 10px', border:'1px solid #ddd', borderRadius:6, fontSize:13 }} />
      <label style={{ fontSize:13, color:'#666' }}>To</label>
      <input type="date" value={end} onChange={e => onChange('end', e.target.value)} style={{ padding:'6px 10px', border:'1px solid #ddd', borderRadius:6, fontSize:13 }} />
    </div>
  );
}

export default function Analytics() {
  const [tab, setTab] = useState('overview');
  const today = new Date().toISOString().slice(0,10);
  const jan1 = `${new Date().getFullYear()}-01-01`;
  const [range, setRange] = useState({ start: jan1, end: today });
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const fmt$ = v => v != null ? `$${Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—';
  const fmtN = v => v != null ? Number(v).toLocaleString() : '—';

  const fetchTab = useCallback(async () => {
    setLoading(true);
    const q = `?start=${range.start}&end=${range.end}`;
    const endpoints = {
      overview: [['avg_transaction',`/api/analytics/avg-transaction${q}`],['conversion',`/api/analytics/conversion-rate${q}`],['turnover',`/api/analytics/inventory-turnover${q}`],['shrinkage',`/api/analytics/shrinkage${q}`]],
      sales: [['velocity',`/api/analytics/sales-velocity${q}`],['basket',`/api/analytics/basket-analysis${q}`],['genre_artist',`/api/analytics/genre-artist-trends${q}`],['peak',`/api/analytics/peak-times${q}`]],
      customers: [['demographics',`/api/analytics/customer-demographics${q}`],['patterns',`/api/analytics/customer-purchase-patterns${q}`]],
      inventory: [['turnover',`/api/analytics/inventory-turnover${q}`],['predictive',`/api/analytics/predictive-inventory`],['shrinkage',`/api/analytics/shrinkage${q}`]],
      seasonal: [['seasonal',`/api/analytics/seasonal-trends`],['yoy',`/api/analytics/year-over-year`],['demand',`/api/analytics/seasonal-demand`]],
      theft: [['theft',`/api/analytics/theft-prevention${q}`],['shrinkage',`/api/analytics/shrinkage${q}`]],
    };
    try {
      const pairs = endpoints[tab] || [];
      const results = await Promise.all(pairs.map(([,url]) => api.get(url).then(r=>r.data).catch(()=>null)));
      const merged = {};
      pairs.forEach(([key],i) => { merged[key] = results[i]; });
      setData(merged);
    } catch(e){ console.error(e); } finally { setLoading(false); }
  }, [tab, range]);

  useEffect(() => { fetchTab(); }, [fetchTab]);

  return (
    <div style={{ padding:24, fontFamily:'system-ui,sans-serif', maxWidth:1200 }}>
      <h2 style={{ margin:'0 0 20px', color:'#1a1a2e' }}>Analytics & Business Intelligence</h2>
      <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'2px solid #eee' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding:'8px 16px', border:'none', background:'none', cursor:'pointer', fontWeight:tab===t.key?700:400, color:tab===t.key?'#4f46e5':'#555', borderBottom:tab===t.key?'3px solid #4f46e5':'3px solid transparent', fontSize:14, marginBottom:-2 }}>{t.label}</button>
        ))}
      </div>
      <DateRange start={range.start} end={range.end} onChange={(f,v)=>setRange(r=>({...r,[f]:v}))} />
      {loading && <div style={{ color:'#888', marginBottom:16 }}>Loading…</div>}

      {tab==='overview' && (
        <div>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:32 }}>
            <StatCard label="Avg Transaction" value={fmt$(data.avg_transaction?.avg_transaction_value)} sub={`Median ${fmt$(data.avg_transaction?.median_transaction)}`} />
            <StatCard label="Total Revenue" value={fmt$(data.avg_transaction?.total_revenue)} sub={`${fmtN(data.avg_transaction?.total_transactions)} transactions`} />
            <StatCard label="Conversion Rate" value={data.conversion?.conversion_rate_pct!=null?`${data.conversion.conversion_rate_pct}%`:'—'} sub={`${fmtN(data.conversion?.total_purchasers)} of ${fmtN(data.conversion?.total_interactions)}`} />
            <StatCard label="Shrinkage Value" value={fmt$(data.shrinkage?.totals?.total_value)} sub={`${fmtN(data.shrinkage?.totals?.total_items)} items`} />
          </div>
          <h3 style={{ margin:'0 0 12px' }}>Inventory Turnover by Category</h3>
          <Table columns={[{key:'category',label:'Category'},{key:'units_sold',label:'Units Sold'},{key:'current_stock',label:'In Stock'},{key:'turnover_ratio',label:'Turnover Ratio'},{key:'avg_days_to_sell',label:'Avg Days to Sell'}]} rows={data.turnover} />
        </div>
      )}

      {tab==='sales' && (
        <div>
          <h3 style={{ margin:'0 0 12px' }}>Sales Velocity by Genre</h3>
          <Table columns={[{key:'genre',label:'Genre'},{key:'units_sold',label:'Units Sold'},{key:'units_per_week',label:'Units/Week'},{key:'total_revenue',label:'Revenue',render:r=>fmt$(r.total_revenue)}]} rows={data.velocity} />
          <h3 style={{ margin:'24px 0 12px' }}>Top Genres & Artists</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
            <div>
              <div style={{ fontWeight:600, marginBottom:8, fontSize:14 }}>Top Genres</div>
              <Table columns={[{key:'genre',label:'Genre'},{key:'units_sold',label:'Units'},{key:'revenue',label:'Revenue',render:r=>fmt$(r.revenue)},{key:'avg_price',label:'Avg Price',render:r=>fmt$(r.avg_price)}]} rows={data.genre_artist?.top_genres} />
            </div>
            <div>
              <div style={{ fontWeight:600, marginBottom:8, fontSize:14 }}>Top Artists</div>
              <Table columns={[{key:'artist',label:'Artist'},{key:'units_sold',label:'Units'},{key:'revenue',label:'Revenue',render:r=>fmt$(r.revenue)}]} rows={data.genre_artist?.top_artists} />
            </div>
          </div>
          <h3 style={{ margin:'24px 0 12px' }}>Basket Analysis — What Sells Together</h3>
          <Table columns={[{key:'category_a',label:'Category A'},{key:'category_b',label:'Category B'},{key:'co_occurrence_count',label:'Times Sold Together'}]} rows={data.basket} />
          <h3 style={{ margin:'24px 0 12px' }}>Peak Times</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
            <div>
              <div style={{ fontWeight:600, marginBottom:8, fontSize:14 }}>By Hour</div>
              <Table columns={[{key:'hour',label:'Hour',render:r=>`${r.hour}:00`},{key:'transaction_count',label:'Transactions'},{key:'avg_transaction',label:'Avg Sale',render:r=>fmt$(r.avg_transaction)}]} rows={data.peak?.by_hour} />
            </div>
            <div>
              <div style={{ fontWeight:600, marginBottom:8, fontSize:14 }}>By Day</div>
              <Table columns={[{key:'day_name',label:'Day'},{key:'transaction_count',label:'Transactions'},{key:'avg_transaction',label:'Avg Sale',render:r=>fmt$(r.avg_transaction)}]} rows={data.peak?.by_day} />
            </div>
          </div>
        </div>
      )}

      {tab==='customers' && (
        <div>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:24 }}>
            <StatCard label="Repeat Purchase Rate" value={data.patterns?.repeat_rate?.repeat_rate_pct!=null?`${data.patterns.repeat_rate.repeat_rate_pct}%`:'—'} />
            <StatCard label="Avg Days Between Purchases" value={data.patterns?.avg_purchase_gap?.avg_days_between_purchases??'—'} />
            <StatCard label="At-Risk Customers" value={fmtN(data.patterns?.churn_risk?.at_risk_customers)} sub="Bought before, not this period" />
          </div>
          <h3 style={{ margin:'0 0 12px' }}>Spend Distribution</h3>
          <Table columns={[{key:'spend_bucket',label:'Spend Range'},{key:'customer_count',label:'Customers'}]} rows={data.demographics?.spend_distribution} />
          <h3 style={{ margin:'24px 0 12px' }}>Purchase Frequency</h3>
          <Table columns={[{key:'frequency_bucket',label:'Frequency'},{key:'customer_count',label:'Customers'}]} rows={data.demographics?.frequency_distribution} />
          <h3 style={{ margin:'24px 0 12px' }}>Top Customers by Spend</h3>
          <Table columns={[{key:'first_name',label:'First'},{key:'last_name',label:'Last'},{key:'total_purchases',label:'Purchases'},{key:'lifetime_value',label:'Lifetime Value',render:r=>fmt$(r.lifetime_value)},{key:'last_purchase',label:'Last Purchase',render:r=>r.last_purchase?new Date(r.last_purchase).toLocaleDateString():'—'}]} rows={data.patterns?.top_customers} />
        </div>
      )}

      {tab==='inventory' && (
        <div>
          <h3 style={{ margin:'0 0 12px' }}>Predictive Restock Suggestions</h3>
          <Table columns={[{key:'genre',label:'Genre'},{key:'category',label:'Category'},{key:'sold_last_90_days',label:'Sold (90d)'},{key:'units_per_week',label:'Units/Week'},{key:'current_stock',label:'In Stock'},{key:'weeks_of_stock_remaining',label:'Weeks Remaining'},{key:'suggestion',label:'Status',render:r=>{
            const c={Critical:{bg:'#fee2e2',color:'#991b1b'},Low:{bg:'#fef9c3',color:'#92400e'},Out:{bg:'#fecaca',color:'#7f1d1d'},OK:{bg:'#dcfce7',color:'#166534'}};
            const k=r.suggestion?.includes('Critical')?'Critical':r.suggestion?.includes('Low')?'Low':r.suggestion?.includes('Out')?'Out':'OK';
            return <span style={{ padding:'2px 8px', borderRadius:12, fontSize:12, fontWeight:600, background:c[k].bg, color:c[k].color }}>{r.suggestion}</span>;
          }}]} rows={data.predictive} />
          <h3 style={{ margin:'24px 0 12px' }}>Turnover by Category</h3>
          <Table columns={[{key:'category',label:'Category'},{key:'units_sold',label:'Units Sold'},{key:'current_stock',label:'In Stock'},{key:'turnover_ratio',label:'Turnover Ratio'},{key:'avg_days_to_sell',label:'Avg Days to Sell'}]} rows={data.turnover} />
          <h3 style={{ margin:'24px 0 12px' }}>Shrinkage</h3>
          <div style={{ display:'flex', gap:16, marginBottom:16 }}>
            <StatCard label="Total Items" value={fmtN(data.shrinkage?.totals?.total_items)} />
            <StatCard label="Total Value Lost" value={fmt$(data.shrinkage?.totals?.total_value)} />
          </div>
          <Table columns={[{key:'reason',label:'Reason'},{key:'item_count',label:'Items'},{key:'estimated_value_lost',label:'Value Lost',render:r=>fmt$(r.estimated_value_lost)}]} rows={data.shrinkage?.by_reason} />
        </div>
      )}

      {tab==='seasonal' && (
        <div>
          <h3 style={{ margin:'0 0 12px' }}>Quarterly Revenue (All Time)</h3>
          <Table columns={[{key:'label',label:'Quarter'},{key:'transactions',label:'Transactions'},{key:'revenue',label:'Revenue',render:r=>fmt$(r.revenue)},{key:'avg_sale',label:'Avg Sale',render:r=>fmt$(r.avg_sale)}]} rows={data.seasonal} />
          <h3 style={{ margin:'24px 0 12px' }}>Year-Over-Year by Month</h3>
          {data.yoy?.length>0 ? (() => {
            const years=[...new Set(data.yoy.flatMap(m=>Object.keys(m.years)))].sort();
            return (
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
                  <thead><tr style={{ background:'#f5f5f5' }}>
                    <th style={{ padding:'8px 12px', textAlign:'left', borderBottom:'2px solid #eee' }}>Month</th>
                    {years.flatMap(y=>[<th key={`${y}t`} style={{ padding:'8px 12px', textAlign:'left', borderBottom:'2px solid #eee' }}>{y} Tx</th>,<th key={`${y}r`} style={{ padding:'8px 12px', textAlign:'left', borderBottom:'2px solid #eee' }}>{y} Rev</th>])}
                  </tr></thead>
                  <tbody>{data.yoy.map((row,i)=>(
                    <tr key={i} style={{ borderBottom:'1px solid #f0f0f0' }}>
                      <td style={{ padding:'8px 12px' }}>{row.month_name}</td>
                      {years.flatMap(y=>[<td key={`${y}t`} style={{ padding:'8px 12px' }}>{row.years[y]?.transactions??'—'}</td>,<td key={`${y}r`} style={{ padding:'8px 12px' }}>{fmt$(row.years[y]?.revenue)}</td>])}
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            );
          })() : <div style={{ color:'#aaa' }}>No data yet</div>}
        </div>
      )}

      {tab==='theft' && (
        <div>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom:24 }}>
            <StatCard label="Voided Sales" value={fmtN(data.theft?.voided_sales?.voided_count)} sub={fmt$(data.theft?.voided_sales?.voided_value)} />
            <StatCard label="Refunds" value={fmtN(data.theft?.refunds?.refund_count)} sub={fmt$(data.theft?.refunds?.total_refunded)} />
            <StatCard label="Shrinkage Items" value={fmtN(data.shrinkage?.totals?.total_items)} sub={fmt$(data.shrinkage?.totals?.total_value)} />
          </div>
          <h3 style={{ margin:'0 0 12px' }}>Shrinkage by Reason</h3>
          <Table columns={[{key:'reason',label:'Reason'},{key:'count',label:'Items'},{key:'value_lost',label:'Value Lost',render:r=>fmt$(r.value_lost)}]} rows={data.theft?.shrinkage_by_reason} />
          <h3 style={{ margin:'24px 0 12px' }}>Staff Flag Activity</h3>
          <Table columns={[{key:'first_name',label:'First'},{key:'last_name',label:'Last'},{key:'role',label:'Role'},{key:'action_type',label:'Action'},{key:'action_count',label:'Count'}]} rows={data.theft?.staff_flag_activity} />
          <h3 style={{ margin:'32px 0 12px' }}>Log Shrinkage Event</h3>
          <ShrinkageForm />
        </div>
      )}
    </div>
  );
}

function ShrinkageForm() {
  const [form, setForm] = useState({ inventory_id:'', reason:'theft', cost_basis:'', notes:'' });
  const [msg, setMsg] = useState('');
  const handleSubmit = async e => {
    e.preventDefault();
    try {
      await (await import('../utils/api')).default.post('/api/analytics/shrinkage', form);
      setMsg('Shrinkage event logged.');
      setForm({ inventory_id:'', reason:'theft', cost_basis:'', notes:'' });
    } catch { setMsg('Error logging shrinkage.'); }
  };
  return (
    <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12, maxWidth:420 }}>
      <input placeholder="Inventory ID" value={form.inventory_id} onChange={e=>setForm(f=>({...f,inventory_id:e.target.value}))} style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:6, fontSize:14 }} required />
      <select value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:6, fontSize:14 }}>
        <option value="theft">Theft</option><option value="damage">Damage</option><option value="loss">Loss</option><option value="admin_error">Admin Error</option><option value="other">Other</option>
      </select>
      <input type="number" step="0.01" placeholder="Est. cost basis ($)" value={form.cost_basis} onChange={e=>setForm(f=>({...f,cost_basis:e.target.value}))} style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:6, fontSize:14 }} />
      <textarea placeholder="Notes (optional)" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:6, fontSize:14, minHeight:70 }} />
      <button type="submit" style={{ padding:'10px 20px', background:'#dc2626', color:'#fff', border:'none', borderRadius:6, fontWeight:600, cursor:'pointer', fontSize:14 }}>Log Shrinkage</button>
      {msg && <div style={{ color:msg.includes('Error')?'#dc2626':'#16a34a', fontSize:13 }}>{msg}</div>}
    </form>
  );
}
