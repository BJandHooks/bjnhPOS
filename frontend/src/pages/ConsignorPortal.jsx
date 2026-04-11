import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';

const PortalCtx = createContext(null);
const usePortal = () => useContext(PortalCtx);

function PortalProvider({ children }) {
  const [consignor, setConsignor] = useState(() => { try { return JSON.parse(sessionStorage.getItem('pc')); } catch { return null; } });
  const [token, setToken] = useState(() => sessionStorage.getItem('pt') || null);
  const login = (tok, c) => { sessionStorage.setItem('pt', tok); sessionStorage.setItem('pc', JSON.stringify(c)); setToken(tok); setConsignor(c); };
  const logout = () => { sessionStorage.removeItem('pt'); sessionStorage.removeItem('pc'); setToken(null); setConsignor(null); };
  return <PortalCtx.Provider value={{ consignor, token, login, logout }}>{children}</PortalCtx.Provider>;
}

async function pFetch(path, token) {
  const res = await fetch(`/api/portal${path}`, { headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` } });
  if (\!res.ok) throw new Error((await res.json()).error || 'Failed');
  return res.json();
}

function PTable({ columns, rows }) {
  if (\!rows || \!rows.length) return <div style={{ color:'#9ca3af', padding:'12px 0', fontSize:14 }}>Nothing here yet.</div>;
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
        <thead><tr style={{ background:'#f9fafb' }}>
          {columns.map(c => <th key={c.key} style={{ padding:'8px 14px', textAlign:'left', borderBottom:'2px solid #e5e7eb', fontWeight:600, color:'#374151', whiteSpace:'nowrap' }}>{c.label}</th>)}
        </tr></thead>
        <tbody>{rows.map((row,i) => (
          <tr key={i} style={{ borderBottom:'1px solid #f3f4f6' }}>
            {columns.map(c => <td key={c.key} style={{ padding:'8px 14px', whiteSpace:'nowrap' }}>{c.render?c.render(row):(row[c.key]??'—')}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function Pill({ label, value, color='#4f46e5' }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, padding:'14px 20px', minWidth:140 }}>
      <div style={{ fontSize:12, color:'#9ca3af', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:22, fontWeight:700, color }}>{value??'—'}</div>
    </div>
  );
}

function Badge({ status }) {
  const m = { available:{bg:'#dcfce7',c:'#166534'}, sold:{bg:'#dbeafe',c:'#1e40af'}, expired:{bg:'#fee2e2',c:'#991b1b'}, pending:{bg:'#fef9c3',c:'#92400e'}, paid:{bg:'#dcfce7',c:'#166534'}, cash:{bg:'#f3f4f6',c:'#374151'}, store_credit:{bg:'#ede9fe',c:'#4f46e5'} };
  const s = m[status] || { bg:'#f3f4f6', c:'#374151' };
  return <span style={{ padding:'2px 8px', borderRadius:10, fontSize:12, fontWeight:600, background:s.bg, color:s.c }}>{status?.replace(/_/g,' ')}</span>;
}

function Login() {
  const { login } = usePortal();
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const res = await fetch('/api/portal/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email,pin}) });
      const d = await res.json();
      if (\!res.ok) throw new Error(d.error||'Login failed');
      login(d.token, d.consignor);
    } catch(e) { setErr(e.message); } finally { setLoading(false); }
  };
  return (
    <div style={{ fontFamily:'system-ui,sans-serif', background:'#f8f9fa', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:12, padding:40, width:360, boxShadow:'0 4px 24px rgba(0,0,0,0.08)', border:'1px solid #e5e7eb' }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ fontSize:28, fontWeight:900, color:'#1a1a2e', letterSpacing:-1 }}>bjnhPOS</div>
          <div style={{ fontSize:13, color:'#9ca3af', marginTop:4 }}>Consignor Portal</div>
        </div>
        <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus style={{ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:7, fontSize:14, boxSizing:'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize:13, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>Portal PIN</label>
            <input type="password" value={pin} onChange={e=>setPin(e.target.value)} required maxLength={12} placeholder="Enter your PIN" style={{ width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:7, fontSize:14, boxSizing:'border-box' }} />
          </div>
          {err && <div style={{ background:'#fee2e2', color:'#dc2626', padding:'8px 12px', borderRadius:6, fontSize:13 }}>{err}</div>}
          <button type="submit" disabled={loading} style={{ padding:11, background:'#4f46e5', color:'#fff', border:'none', borderRadius:7, fontWeight:700, fontSize:15, cursor:'pointer', marginTop:4 }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p style={{ textAlign:'center', fontSize:12, color:'#9ca3af', marginTop:20 }}>No PIN? Contact the store to get set up.</p>
      </div>
    </div>
  );
}

const TABS = [{key:'summary',label:'Summary'},{key:'items',label:'My Items'},{key:'earnings',label:'Earnings'},{key:'payouts',label:'Payout History'},{key:'booth',label:'Booth Fees'}];

function Dashboard() {
  const { consignor, token, logout } = usePortal();
  const [tab, setTab] = useState('summary');
  const [d, setD] = useState({});
  const [loading, setLoading] = useState(false);
  const fmt$ = v => v\!=null ? `$${Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—';
  const fmtD = v => v ? new Date(v).toLocaleDateString() : '—';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me, items, earnings, payouts, booth] = await Promise.all([
        pFetch('/me', token), pFetch('/items', token), pFetch('/earnings', token), pFetch('/payouts', token), pFetch('/booth-charges', token)
      ]);
      setD({ me, items, earnings, payouts, booth });
    } catch(e){ console.error(e); } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const balColor = parseFloat(d.earnings?.summary?.current_balance||0) >= 0 ? '#16a34a' : '#dc2626';

  return (
    <div style={{ fontFamily:'system-ui,sans-serif', background:'#f8f9fa', minHeight:'100vh' }}>
      <div style={{ background:'#1a1a2e', color:'#fff', padding:'14px 28px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div><span style={{ fontWeight:900, fontSize:18 }}>bjnhPOS</span><span style={{ fontSize:12, color:'#9ca3af', marginLeft:10 }}>Consignor Portal</span></div>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <span style={{ fontSize:14 }}>👤 {consignor?.name}</span>
          <button onClick={logout} style={{ background:'transparent', border:'1px solid #4b5563', color:'#d1d5db', borderRadius:6, padding:'5px 12px', cursor:'pointer', fontSize:13 }}>Sign Out</button>
        </div>
      </div>
      <div style={{ background:'#fff', borderBottom:'1px solid #e5e7eb', padding:'0 28px', display:'flex' }}>
        {TABS.map(t => <button key={t.key} onClick={()=>setTab(t.key)} style={{ padding:'12px 18px', border:'none', background:'none', cursor:'pointer', fontWeight:tab===t.key?700:400, color:tab===t.key?'#4f46e5':'#6b7280', borderBottom:tab===t.key?'3px solid #4f46e5':'3px solid transparent', fontSize:14 }}>{t.label}</button>)}
      </div>
      <div style={{ padding:28, maxWidth:1100 }}>
        {loading && <div style={{ color:'#9ca3af', marginBottom:16 }}>Loading…</div>}

        {tab==='summary' && (
          <div>
            <h2 style={{ margin:'0 0 20px', fontSize:20 }}>Hello, {consignor?.name}</h2>
            <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:28 }}>
              <Pill label="Items Available" value={d.items?.summary?.available} />
              <Pill label="Items Sold" value={d.items?.summary?.sold} color="#16a34a" />
              <Pill label="Inventory Value" value={fmt$(d.items?.summary?.inventory_value)} color="#0891b2" />
              <Pill label="Current Balance" value={fmt$(d.earnings?.summary?.current_balance)} color={balColor} />
            </div>
            <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:24, marginBottom:20 }}>
              <h3 style={{ margin:'0 0 16px', fontSize:16 }}>Your Agreement</h3>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:16, fontSize:14 }}>
                <div><span style={{ color:'#9ca3af' }}>Your Split</span><br /><strong>{d.me?.split_percentage}%</strong></div>
                <div><span style={{ color:'#9ca3af' }}>Monthly Booth Fee</span><br /><strong>{fmt$(d.me?.booth_fee_monthly)}</strong></div>
                <div><span style={{ color:'#9ca3af' }}>Payout Schedule</span><br /><strong style={{ textTransform:'capitalize' }}>{d.me?.payout_schedule?.replace(/_/g,' ')}</strong></div>
                <div><span style={{ color:'#9ca3af' }}>Min. Payout Balance</span><br /><strong>{fmt$(d.me?.minimum_payout_balance)}</strong></div>
                <div><span style={{ color:'#9ca3af' }}>Contract Start</span><br /><strong>{fmtD(d.me?.contract_start)}</strong></div>
              </div>
            </div>
            <div style={{ background:'#fef9c3', border:'1px solid #fde68a', borderRadius:8, padding:'12px 16px', fontSize:13, color:'#92400e' }}>
              Payouts are processed by the store on your contract schedule. You cannot request a payout outside your contract terms.
            </div>
          </div>
        )}

        {tab==='items' && (
          <div>
            <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:24 }}>
              <Pill label="Available" value={d.items?.summary?.available} />
              <Pill label="Sold" value={d.items?.summary?.sold} color="#16a34a" />
              <Pill label="Expired" value={d.items?.summary?.expired} color="#dc2626" />
              <Pill label="Expiring Soon" value={d.items?.summary?.expiring_soon} color="#d97706" />
            </div>
            <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:24 }}>
              <h3 style={{ margin:'0 0 16px', fontSize:16 }}>All My Items</h3>
              <PTable columns={[{key:'sku',label:'SKU'},{key:'title',label:'Title'},{key:'artist',label:'Artist'},{key:'format',label:'Format'},{key:'condition',label:'Condition'},{key:'price',label:'Price',render:r=>fmt$(r.price)},{key:'status',label:'Status',render:r=><Badge status={r.status}/>},{key:'expiration_date',label:'Expires',render:r=>fmtD(r.expiration_date)},{key:'created_at',label:'Added',render:r=>fmtD(r.created_at)}]} rows={d.items?.items} />
            </div>
          </div>
        )}

        {tab==='earnings' && (
          <div>
            <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:24 }}>
              <Pill label="Total Earned" value={fmt$(d.earnings?.summary?.total_earned)} color="#16a34a" />
              <Pill label="Total Paid Out" value={fmt$(d.earnings?.summary?.total_paid_out)} color="#4f46e5" />
              <Pill label="Booth Fees" value={fmt$(d.earnings?.summary?.total_booth_fees)} color="#d97706" />
              <Pill label="Current Balance" value={fmt$(d.earnings?.summary?.current_balance)} color={balColor} />
            </div>
            <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:24 }}>
              <h3 style={{ margin:'0 0 16px', fontSize:16 }}>Sales Breakdown</h3>
              <PTable columns={[{key:'title',label:'Title'},{key:'artist',label:'Artist'},{key:'format',label:'Format'},{key:'listed_price',label:'Listed',render:r=>fmt$(r.listed_price)},{key:'sale_price',label:'Sold For',render:r=>fmt$(r.sale_price)},{key:'consignor_share',label:'Your Share',render:r=><strong style={{color:'#16a34a'}}>{fmt$(r.consignor_share)}</strong>},{key:'sold_at',label:'Date',render:r=>fmtD(r.sold_at)}]} rows={d.earnings?.sales} />
            </div>
          </div>
        )}

        {tab==='payouts' && (
          <div>
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'12px 16px', marginBottom:20, fontSize:14, color:'#166534' }}>
              Payouts are processed by the store on your contract schedule. You cannot request a payout through this portal.
            </div>
            <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:24 }}>
              <h3 style={{ margin:'0 0 16px', fontSize:16 }}>Payout History</h3>
              <PTable columns={[{key:'amount',label:'Amount',render:r=>fmt$(r.amount)},{key:'method',label:'Method',render:r=><Badge status={r.method}/>},{key:'status',label:'Status',render:r=><Badge status={r.status}/>},{key:'paid_at',label:'Paid On',render:r=>fmtD(r.paid_at)},{key:'notes',label:'Notes'}]} rows={d.payouts} />
            </div>
          </div>
        )}

        {tab==='booth' && (
          <div>
            <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:24 }}>
              <h3 style={{ margin:'0 0 4px', fontSize:16 }}>Booth Rental Charges</h3>
              <p style={{ color:'#6b7280', fontSize:14, margin:'0 0 16px' }}>Your booth fee is {fmt$(d.me?.booth_fee_monthly)} per month, deducted from earnings before payout.</p>
              <PTable columns={[{key:'period_start',label:'Period Start',render:r=>fmtD(r.period_start)},{key:'period_end',label:'Period End',render:r=>fmtD(r.period_end)},{key:'amount',label:'Amount',render:r=>fmt$(r.amount)},{key:'status',label:'Status',render:r=><Badge status={r.status}/>}]} rows={d.booth} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ConsignorPortal() {
  return <PortalProvider><Inner /></PortalProvider>;
}

function Inner() {
  const { consignor } = usePortal();
  return consignor ? <Dashboard /> : <Login />;
}
