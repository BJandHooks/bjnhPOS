import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const PLATFORMS = [
  { key: 'facebook', label: 'Facebook', color: '#1877f2', icon: 'f' },
  { key: 'instagram', label: 'Instagram', color: '#e1306c', icon: '📷' },
  { key: 'tiktok', label: 'TikTok', color: '#010101', icon: '♪' },
  { key: 'google_business', label: 'Google Business', color: '#4285f4', icon: 'G' },
];

const TABS = [
  { key: 'connections', label: 'Connections' },
  { key: 'posts', label: 'Post Queue' },
  { key: 'captions', label: 'Caption Pool' },
  { key: 'events', label: 'Event Listings' },
];

function Badge({ children, color = '#6b7280', bg = '#f3f4f6' }) {
  return <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: bg, color }}>{children}</span>;
}

function PlatformChip({ p, selected, onClick }) {
  const meta = PLATFORMS.find(x => x.key === p) || { label: p, color: '#888', icon: '?' };
  return (
    <button onClick={onClick} style={{
      padding: '4px 10px', borderRadius: 14, border: `2px solid ${selected ? meta.color : '#ddd'}`,
      background: selected ? meta.color : '#fff', color: selected ? '#fff' : '#555',
      fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all .15s',
    }}>{meta.icon} {meta.label}</button>
  );
}

export default function Marketing() {
  const [tab, setTab] = useState('connections');
  const [connections, setConnections] = useState([]);
  const [posts, setPosts] = useState([]);
  const [captions, setCaptions] = useState([]);
  const [eventListings, setEventListings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [c, p, cap, ev] = await Promise.all([
        api.get('/api/marketing/connections').then(r => r.data),
        api.get('/api/marketing/posts').then(r => r.data),
        api.get('/api/marketing/captions').then(r => r.data),
        api.get('/api/marketing/event-listings').then(r => r.data),
      ]);
      setConnections(c); setPosts(p); setCaptions(cap); setEventListings(ev);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const flash = m => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const startOAuth = async platform => {
    const map = { facebook: 'facebook', instagram: 'facebook', tiktok: 'tiktok', google_business: 'google' };
    const key = map[platform];
    try {
      const r = await api.get(`/api/marketing/oauth/${key}/start`);
      window.location.href = r.data.oauth_url;
    } catch (e) { flash(e.response?.data?.error || 'OAuth start failed'); }
  };

  const disconnect = async platform => {
    const map = { facebook: 'facebook', instagram: 'facebook', tiktok: 'tiktok', google_business: 'google' };
    try {
      await api.post(`/api/marketing/oauth/${map[platform]}/disconnect`);
      flash(`${platform} disconnected`);
      loadAll();
    } catch (e) { flash('Disconnect failed'); }
  };

  const publishPost = async id => {
    try {
      const r = await api.post(`/api/marketing/posts/${id}/publish`);
      flash('Published! ' + Object.keys(r.data.results).join(', '));
      loadAll();
    } catch (e) { flash(e.response?.data?.error || 'Publish failed'); }
  };

  const deletePost = async id => {
    if (!window.confirm('Delete this post?')) return;
    await api.delete(`/api/marketing/posts/${id}`);
    loadAll();
  };

  const publishEvent = async id => {
    try {
      const r = await api.post(`/api/marketing/event-listings/${id}/publish`);
      flash('Event published! ID: ' + r.data.id);
      loadAll();
    } catch (e) { flash(e.response?.data?.error || 'Event publish failed'); }
  };

  const s = { card: { background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:24, marginBottom:20 } };

  return (
    <div style={{ padding:24, fontFamily:'system-ui,sans-serif', maxWidth:1100 }}>
      <h2 style={{ margin:'0 0 20px', color:'#1a1a2e' }}>Marketing Hub</h2>
      {msg && <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'10px 16px', marginBottom:16, fontSize:14, color:'#166534' }}>{msg}</div>}

      {/* Tab bar */}
      <div style={{ display:'flex', gap:4, marginBottom:24, borderBottom:'2px solid #eee' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding:'8px 16px', border:'none', background:'none', cursor:'pointer', fontWeight:tab===t.key?700:400, color:tab===t.key?'#4f46e5':'#555', borderBottom:tab===t.key?'3px solid #4f46e5':'3px solid transparent', fontSize:14, marginBottom:-2 }}>{t.label}</button>
        ))}
      </div>

      {loading && <div style={{ color:'#888', marginBottom:12 }}>Loading…</div>}

      {/* CONNECTIONS */}
      {tab === 'connections' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16 }}>
            {PLATFORMS.map(plat => {
              const conn = connections.find(c => c.platform === plat.key) || {};
              const connected = conn.is_connected;
              return (
                <div key={plat.key} style={{ ...s.card, borderTop:`4px solid ${plat.color}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                    <div style={{ width:36, height:36, borderRadius:8, background:plat.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, fontSize:16 }}>{plat.icon}</div>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15 }}>{plat.label}</div>
                      <div style={{ fontSize:12, color: connected ? '#16a34a' : '#9ca3af' }}>{connected ? '● Connected' : '○ Not connected'}</div>
                    </div>
                  </div>
                  {connected && conn.page_name && <div style={{ fontSize:13, color:'#6b7280', marginBottom:8 }}>📄 {conn.page_name}</div>}
                  {connected && conn.token_expires_at && <div style={{ fontSize:12, color:'#9ca3af', marginBottom:12 }}>Token expires: {new Date(conn.token_expires_at).toLocaleDateString()}</div>}
                  {plat.key === 'instagram' ? (
                    <div style={{ fontSize:13, color:'#6b7280' }}>Instagram connects automatically via your Facebook Page connection.</div>
                  ) : (
                    <button onClick={() => connected ? disconnect(plat.key) : startOAuth(plat.key)}
                      style={{ padding:'8px 14px', border:'none', borderRadius:6, fontWeight:600, fontSize:13, cursor:'pointer', background: connected ? '#fee2e2' : plat.color, color: connected ? '#dc2626' : '#fff' }}>
                      {connected ? 'Disconnect' : `Connect ${plat.label}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ ...s.card, background:'#fef9c3', border:'1px solid #fde68a', marginTop:8 }}>
            <div style={{ fontWeight:600, marginBottom:6 }}>API credentials needed in your .env file</div>
            <div style={{ fontSize:13, color:'#78350f', lineHeight:1.6 }}>
              <code>META_APP_ID</code>, <code>META_APP_SECRET</code> — from Meta for Developers<br/>
              <code>TIKTOK_CLIENT_KEY</code>, <code>TIKTOK_CLIENT_SECRET</code> — from TikTok for Developers<br/>
              <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> — from Google Cloud Console (Business Profile API)<br/>
              <code>BASE_URL</code> — your public domain (e.g. https://bjnhpos.com)
            </div>
          </div>
        </div>
      )}

      {/* POST QUEUE */}
      {tab === 'posts' && <PostQueue posts={posts} onPublish={publishPost} onDelete={deletePost} onRefresh={loadAll} flash={flash} />}

      {/* CAPTION POOL */}
      {tab === 'captions' && <CaptionPool captions={captions} onRefresh={loadAll} flash={flash} />}

      {/* EVENT LISTINGS */}
      {tab === 'events' && <EventListings listings={eventListings} onPublish={publishEvent} onRefresh={loadAll} flash={flash} />}
    </div>
  );
}

// ── Post Queue ─────────────────────────────────────────────────────────────────
function PostQueue({ posts, onPublish, onDelete, onRefresh, flash }) {
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ title:'', caption:'', media_url:'', media_type:'image', platforms:[], scheduled_at:'', track:'prime' });

  const statusColor = { draft:['#f3f4f6','#374151'], scheduled:['#dbeafe','#1e40af'], published:['#dcfce7','#166534'], failed:['#fee2e2','#991b1b'], publishing:['#fef9c3','#92400e'] };

  const filtered = filter === 'all' ? posts : posts.filter(p => p.status === filter);

  const submit = async e => {
    e.preventDefault();
    if (!form.platforms.length) return flash('Select at least one platform');
    try {
      await api.post('/api/marketing/posts', { ...form, scheduled_at: form.scheduled_at || undefined });
      setForm({ title:'', caption:'', media_url:'', media_type:'image', platforms:[], scheduled_at:'', track:'prime' });
      setShowForm(false);
      onRefresh();
      flash('Post created');
    } catch (e) { flash(e.response?.data?.error || 'Error'); }
  };

  const togglePlatform = p => setForm(f => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter(x=>x!==p) : [...f.platforms, p] }));

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', gap:6 }}>
          {['all','draft','scheduled','published','failed'].map(s => (
            <button key={s} onClick={()=>setFilter(s)} style={{ padding:'5px 12px', borderRadius:14, border:'none', background:filter===s?'#4f46e5':'#f3f4f6', color:filter===s?'#fff':'#374151', fontSize:13, fontWeight:600, cursor:'pointer' }}>{s}</button>
          ))}
        </div>
        <button onClick={()=>setShowForm(v=>!v)} style={{ padding:'8px 16px', background:'#4f46e5', color:'#fff', border:'none', borderRadius:7, fontWeight:600, fontSize:14, cursor:'pointer' }}>+ New Post</button>
      </div>

      {showForm && (
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:24, marginBottom:20 }}>
          <h3 style={{ margin:'0 0 16px' }}>New Post</h3>
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <input placeholder="Title (optional)" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:6, fontSize:14 }} />
            <textarea placeholder="Caption *" value={form.caption} onChange={e=>setForm(f=>({...f,caption:e.target.value}))} required rows={3} style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:6, fontSize:14 }} />
            <input placeholder="Media URL (photo or video)" value={form.media_url} onChange={e=>setForm(f=>({...f,media_url:e.target.value}))} style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:6, fontSize:14 }} />
            <div style={{ display:'flex', gap:8 }}>
              {['image','video','reel'].map(t => (
                <button key={t} type="button" onClick={()=>setForm(f=>({...f,media_type:t}))} style={{ padding:'5px 12px', borderRadius:14, border:'none', background:form.media_type===t?'#4f46e5':'#f3f4f6', color:form.media_type===t?'#fff':'#374151', fontSize:13, fontWeight:600, cursor:'pointer' }}>{t}</button>
              ))}
            </div>
            <div>
              <div style={{ fontSize:13, color:'#666', marginBottom:6 }}>Platforms *</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {PLATFORMS.map(p => <PlatformChip key={p.key} p={p.key} selected={form.platforms.includes(p.key)} onClick={()=>togglePlatform(p.key)} />)}
              </div>
            </div>
            <div style={{ display:'flex', gap:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, color:'#666', marginBottom:4 }}>Schedule (leave blank to save as draft)</div>
                <input type="datetime-local" value={form.scheduled_at} onChange={e=>setForm(f=>({...f,scheduled_at:e.target.value}))} style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:6, fontSize:14, width:'100%' }} />
              </div>
              <div>
                <div style={{ fontSize:13, color:'#666', marginBottom:4 }}>Track</div>
                <select value={form.track} onChange={e=>setForm(f=>({...f,track:e.target.value}))} style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:6, fontSize:14 }}>
                  <option value="prime">Prime Time</option>
                  <option value="autopilot">Autopilot</option>
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button type="submit" style={{ padding:'9px 20px', background:'#4f46e5', color:'#fff', border:'none', borderRadius:6, fontWeight:600, fontSize:14, cursor:'pointer' }}>Save Post</button>
              <button type="button" onClick={()=>setShowForm(false)} style={{ padding:'9px 20px', background:'#f3f4f6', color:'#374151', border:'none', borderRadius:6, fontSize:14, cursor:'pointer' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {filtered.length === 0 && <div style={{ color:'#aaa', padding:'20px 0' }}>No posts yet.</div>}
      {filtered.map(post => {
        const [bg, color] = statusColor[post.status] || ['#f3f4f6','#374151'];
        return (
          <div key={post.id} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:20, marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
                  <span style={{ fontWeight:700, fontSize:15 }}>{post.title || 'Untitled post'}</span>
                  <Badge bg={bg} color={color}>{post.status}</Badge>
                  <Badge bg='#ede9fe' color='#4f46e5'>{post.track}</Badge>
                  {(post.platforms||[]).map(p => { const m=PLATFORMS.find(x=>x.key===p); return m ? <Badge key={p} bg={m.color+'22'} color={m.color}>{m.label}</Badge> : null; })}
                </div>
                <div style={{ fontSize:14, color:'#374151', marginBottom:6, whiteSpace:'pre-line' }}>{post.caption}</div>
                {post.media_url && <div style={{ fontSize:12, color:'#9ca3af' }}>📎 {post.media_url}</div>}
                {post.scheduled_at && <div style={{ fontSize:12, color:'#6b7280', marginTop:4 }}>🕐 Scheduled: {new Date(post.scheduled_at).toLocaleString()}</div>}
                {post.published_at && <div style={{ fontSize:12, color:'#16a34a', marginTop:4 }}>✓ Published: {new Date(post.published_at).toLocaleString()}</div>}
                {post.error_details && <div style={{ fontSize:12, color:'#dc2626', marginTop:4 }}>⚠ {JSON.stringify(post.error_details)}</div>}
              </div>
              <div style={{ display:'flex', gap:8, marginLeft:16, flexShrink:0 }}>
                {['draft','scheduled','failed'].includes(post.status) && (
                  <button onClick={()=>onPublish(post.id)} style={{ padding:'6px 14px', background:'#16a34a', color:'#fff', border:'none', borderRadius:6, fontWeight:600, fontSize:13, cursor:'pointer' }}>Publish Now</button>
                )}
                {post.status !== 'published' && (
                  <button onClick={()=>onDelete(post.id)} style={{ padding:'6px 12px', background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:6, fontSize:13, cursor:'pointer' }}>Delete</button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Caption Pool ───────────────────────────────────────────────────────────────
function CaptionPool({ captions, onRefresh, flash }) {
  const [text, setText] = useState('');
  const [bulk, setBulk] = useState('');
  const [showBulk, setShowBulk] = useState(false);

  const addOne = async e => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      await api.post('/api/marketing/captions', { captions: [text] });
      setText(''); onRefresh(); flash('Caption added');
    } catch { flash('Error adding caption'); }
  };

  const addBulk = async () => {
    const lines = bulk.split('\n').map(l=>l.trim()).filter(Boolean);
    if (!lines.length) return;
    try {
      await api.post('/api/marketing/captions', { captions: lines });
      setBulk(''); setShowBulk(false); onRefresh(); flash(`${lines.length} captions added`);
    } catch { flash('Error'); }
  };

  const toggleApprove = async (id, current) => {
    await api.patch(`/api/marketing/captions/${id}/approve`, { approved: !current });
    onRefresh();
  };

  const del = async id => {
    await api.delete(`/api/marketing/captions/${id}`);
    onRefresh();
  };

  return (
    <div>
      <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:20, marginBottom:20 }}>
        <h3 style={{ margin:'0 0 12px' }}>Add Caption</h3>
        <form onSubmit={addOne} style={{ display:'flex', gap:8 }}>
          <input value={text} onChange={e=>setText(e.target.value)} placeholder="Write a caption…" style={{ flex:1, padding:'8px 12px', border:'1px solid #ddd', borderRadius:6, fontSize:14 }} />
          <button type="submit" style={{ padding:'8px 16px', background:'#4f46e5', color:'#fff', border:'none', borderRadius:6, fontWeight:600, fontSize:14, cursor:'pointer' }}>Add</button>
          <button type="button" onClick={()=>setShowBulk(v=>!v)} style={{ padding:'8px 14px', background:'#f3f4f6', color:'#374151', border:'none', borderRadius:6, fontSize:14, cursor:'pointer' }}>Bulk Paste</button>
        </form>
        {showBulk && (
          <div style={{ marginTop:12 }}>
            <div style={{ fontSize:13, color:'#666', marginBottom:6 }}>Paste captions — one per line</div>
            <textarea value={bulk} onChange={e=>setBulk(e.target.value)} rows={6} style={{ width:'100%', padding:'8px 12px', border:'1px solid #ddd', borderRadius:6, fontSize:14, boxSizing:'border-box' }} />
            <button onClick={addBulk} style={{ marginTop:8, padding:'8px 16px', background:'#4f46e5', color:'#fff', border:'none', borderRadius:6, fontWeight:600, cursor:'pointer' }}>Add All</button>
          </div>
        )}
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'center' }}>
        <span style={{ fontSize:14, color:'#6b7280' }}>{captions.length} captions — {captions.filter(c=>c.approved).length} approved for autopilot</span>
      </div>
      {captions.map(c => (
        <div key={c.id} style={{ background:'#fff', border:`1px solid ${c.approved?'#bbf7d0':'#e5e7eb'}`, borderRadius:8, padding:'12px 16px', marginBottom:8, display:'flex', alignItems:'flex-start', gap:12 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, color:'#1f2937', marginBottom:4, whiteSpace:'pre-line' }}>{c.caption}</div>
            <div style={{ fontSize:12, color:'#9ca3af' }}>Used {c.used_count}× {c.last_used_at ? `· Last used ${new Date(c.last_used_at).toLocaleDateString()}` : ''}</div>
          </div>
          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            <button onClick={()=>toggleApprove(c.id,c.approved)} style={{ padding:'4px 10px', borderRadius:12, border:'none', background:c.approved?'#dcfce7':'#f3f4f6', color:c.approved?'#166534':'#6b7280', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              {c.approved ? '✓ Approved' : 'Approve'}
            </button>
            <button onClick={()=>del(c.id)} style={{ padding:'4px 8px', borderRadius:6, border:'none', background:'#fee2e2', color:'#dc2626', fontSize:12, cursor:'pointer' }}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Event Listings ─────────────────────────────────────────────────────────────
function EventListings({ listings, onPublish, onRefresh, flash }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ platform:'facebook', title:'', description:'', start_time:'', end_time:'', location:'', cover_image_url:'', ticket_url:'' });

  const submit = async e => {
    e.preventDefault();
    try {
      await api.post('/api/marketing/event-listings', form);
      setShowForm(false); setForm({ platform:'facebook', title:'', description:'', start_time:'', end_time:'', location:'', cover_image_url:'', ticket_url:'' });
      onRefresh(); flash('Listing created');
    } catch (e) { flash(e.response?.data?.error || 'Error'); }
  };

  const inp = { padding:'8px 12px', border:'1px solid #ddd', borderRadius:6, fontSize:14 };
  const statusColor = { draft:['#f3f4f6','#374151'], published:['#dcfce7','#166534'], cancelled:['#fee2e2','#991b1b'], ended:['#fef9c3','#92400e'] };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
        <button onClick={()=>setShowForm(v=>!v)} style={{ padding:'8px 16px', background:'#4f46e5', color:'#fff', border:'none', borderRadius:7, fontWeight:600, fontSize:14, cursor:'pointer' }}>+ New Event Listing</button>
      </div>

      {showForm && (
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:24, marginBottom:20 }}>
          <h3 style={{ margin:'0 0 16px' }}>New Event Listing</h3>
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div>
              <div style={{ fontSize:13, color:'#666', marginBottom:4 }}>Platform</div>
              <select value={form.platform} onChange={e=>setForm(f=>({...f,platform:e.target.value}))} style={inp}>
                <option value="facebook">Facebook Events</option>
                <option value="google_business">Google My Business</option>
                <option value="eventbrite">Eventbrite (manual — export link)</option>
              </select>
            </div>
            <input placeholder="Event title *" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} style={inp} required />
            <textarea placeholder="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={3} style={inp} />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <div style={{ fontSize:13, color:'#666', marginBottom:4 }}>Start time *</div>
                <input type="datetime-local" value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))} style={{...inp,width:'100%'}} required />
              </div>
              <div>
                <div style={{ fontSize:13, color:'#666', marginBottom:4 }}>End time</div>
                <input type="datetime-local" value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))} style={{...inp,width:'100%'}} />
              </div>
            </div>
            <input placeholder="Location / Venue" value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} style={inp} />
            <input placeholder="Cover image URL" value={form.cover_image_url} onChange={e=>setForm(f=>({...f,cover_image_url:e.target.value}))} style={inp} />
            <input placeholder="Ticket / registration URL" value={form.ticket_url} onChange={e=>setForm(f=>({...f,ticket_url:e.target.value}))} style={inp} />
            <div style={{ display:'flex', gap:10 }}>
              <button type="submit" style={{ padding:'9px 20px', background:'#4f46e5', color:'#fff', border:'none', borderRadius:6, fontWeight:600, fontSize:14, cursor:'pointer' }}>Save Listing</button>
              <button type="button" onClick={()=>setShowForm(false)} style={{ padding:'9px 20px', background:'#f3f4f6', color:'#374151', border:'none', borderRadius:6, fontSize:14, cursor:'pointer' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {listings.length === 0 && <div style={{ color:'#aaa', padding:'20px 0' }}>No event listings yet.</div>}
      {listings.map(l => {
        const plat = PLATFORMS.find(p => p.key === l.platform);
        const [bg, color] = statusColor[l.status] || ['#f3f4f6','#374151'];
        return (
          <div key={l.id} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:20, marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8, flexWrap:'wrap' }}>
                  <span style={{ fontWeight:700, fontSize:15 }}>{l.title}</span>
                  <Badge bg={bg} color={color}>{l.status}</Badge>
                  {plat && <Badge bg={plat.color+'22'} color={plat.color}>{plat.label}</Badge>}
                </div>
                {l.description && <div style={{ fontSize:14, color:'#374151', marginBottom:6 }}>{l.description}</div>}
                <div style={{ fontSize:12, color:'#6b7280' }}>
                  🕐 {l.start_time ? new Date(l.start_time).toLocaleString() : '—'}
                  {l.location && ` · 📍 ${l.location}`}
                </div>
                {l.external_url && <a href={l.external_url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'#4f46e5', display:'block', marginTop:4 }}>View listing ↗</a>}
              </div>
              {l.status === 'draft' && ['facebook','google_business'].includes(l.platform) && (
                <button onClick={()=>onPublish(l.id)} style={{ padding:'6px 14px', background:'#16a34a', color:'#fff', border:'none', borderRadius:6, fontWeight:600, fontSize:13, cursor:'pointer', marginLeft:16, flexShrink:0 }}>Publish to {plat?.label}</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
