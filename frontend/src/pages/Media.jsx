import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useToast } from '../hooks/useToast';

const PLATFORMS = ['facebook', 'instagram', 'tiktok', 'google_my_business'];
const TRACKS = ['autopilot', 'prime_time'];

export default function Media() {
  const { show, Toast } = useToast();
  const [tab, setTab] = useState('queue');
  const [contentQueue, setContentQueue] = useState([]);
  const [posts, setPosts] = useState([]);
  const [captions, setCaptions] = useState([]);
  const [connections, setConnections] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(null);

  useEffect(() => { loadAllData(); }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [queueRes, postsRes, capsRes, connRes, schedRes] = await Promise.all([
        api.get('/media/queue'),
        api.get('/media/posts'),
        api.get('/media/captions'),
        api.get('/media/platform-connections'),
        api.get('/media/autopilot-schedules')
      ]);
      setContentQueue(queueRes.data);
      setPosts(postsRes.data);
      setCaptions(capsRes.data);
      setConnections(connRes.data);
      setSchedules(schedRes.data);
    } catch {
      show('Failed to load data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const approveContent = async (id) => {
    try {
      await api.patch(`/media/queue/${id}/approve`, {});
      show('Content approved.', 'success');
      loadAllData();
    } catch {
      show('Failed to approve.', 'error');
    }
  };

  const removeContent = async (id) => {
    try {
      await api.patch(`/media/queue/${id}/remove`, {});
      show('Content removed from queue.', 'success');
      loadAllData();
    } catch {
      show('Failed to remove.', 'error');
    }
  };

  const openSchedulePost = (content) => {
    setForm({
      content_id: content?.id,
      platform: 'instagram',
      track: 'prime_time',
      scheduled_at: '',
      caption: content?.caption || ''
    });
    setModal('schedule');
  };

  const schedulePost = async () => {
    try {
      if (\!form.scheduled_at) {
        show('Please select a date/time.', 'error');
        return;
      }
      await api.post('/media/schedule-post', form);
      show('Post scheduled.', 'success');
      setModal(null);
      loadAllData();
    } catch {
      show('Failed to schedule post.', 'error');
    }
  };

  const bulkUploadCaptions = async () => {
    try {
      const text = prompt('Paste captions separated by newlines:');
      if (\!text) return;
      const captionList = text.split('\n').filter(c => c.trim());
      await api.post('/media/captions/upload-bulk', { captions: captionList, platform: null });
      show(`${captionList.length} captions uploaded.`, 'success');
      loadAllData();
    } catch {
      show('Failed to upload captions.', 'error');
    }
  };

  const approveCaption = async (id) => {
    try {
      await api.patch(`/media/captions/${id}/approve`, {});
      show('Caption approved.', 'success');
      loadAllData();
    } catch {
      show('Failed to approve caption.', 'error');
    }
  };

  const openConnectPlatform = (platform) => {
    setForm({
      platform,
      access_token: '',
      business_account_id: '',
      page_id: ''
    });
    setModal('connect');
  };

  const connectPlatform = async () => {
    try {
      await api.post('/media/platform-connect', form);
      show(`${form.platform} connected.`, 'success');
      setModal(null);
      loadAllData();
    } catch {
      show('Failed to connect platform.', 'error');
    }
  };

  const openCreateSchedule = () => {
    setForm({
      platform: 'instagram',
      post_time: '10:00',
      randomize_caption: true
    });
    setModal('new-schedule');
  };

  const createSchedule = async () => {
    try {
      await api.post('/media/autopilot-schedule', form);
      show('Schedule created.', 'success');
      setModal(null);
      loadAllData();
    } catch {
      show('Failed to create schedule.', 'error');
    }
  };

  const TabButton = ({ name, label }) => (
    <button
      className={`btn btn-sm ${tab === name ? 'btn-primary' : 'btn-ghost'}`}
      onClick={() => setTab(name)}
      style={{ marginRight: 8 }}>
      {label}
    </button>
  );

  return (
    <div className="main-content">
      {Toast}
      <div className="page-header">
        <h2>Media Hub</h2>
        <span className="text-sm text-muted">Social content management</span>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <TabButton name="queue" label="Content Queue" />
        <TabButton name="posts" label="Posts" />
        <TabButton name="captions" label="Captions" />
        <TabButton name="platforms" label="Platforms" />
        <TabButton name="autopilot" label="Autopilot" />
      </div>

      {/* Content Queue Tab */}
      {tab === 'queue' && (
        <div className="card">
          <div className="card-header">
            <h3>Content Queue</h3>
            <span className="text-muted text-sm">{contentQueue.length} items</span>
          </div>

          <div style={{ padding: 16 }}>
            {contentQueue.length === 0 ? (
              <div className="empty-state">No content in queue</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                {contentQueue.map(item => (
                  <div key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, backgroundColor: '#fafafa' }}>
                    <div style={{ marginBottom: 8 }}>
                      <strong className="text-sm">{item.title || item.inventory_title || 'Untitled'}</strong>
                    </div>
                    {item.caption && <div className="text-xs text-muted" style={{ marginBottom: 8, maxHeight: 60, overflow: 'hidden' }}>{item.caption}</div>}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {\!item.approved && (
                        <button className="btn btn-xs btn-success" onClick={() => approveContent(item.id)}>Approve</button>
                      )}
                      <button className="btn btn-xs btn-primary" onClick={() => openSchedulePost(item)}>Schedule</button>
                      <button className="btn btn-xs btn-ghost" onClick={() => removeContent(item.id)}>Remove</button>
                    </div>
                    {item.approved && <div className="text-xs text-success" style={{ marginTop: 8 }}>✓ Approved</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Posts Tab */}
      {tab === 'posts' && (
        <div className="card">
          <div className="card-header">
            <h3>Scheduled & Posted</h3>
            <span className="text-muted text-sm">{posts.length} posts</span>
          </div>

          <div className="table-wrap">
            {posts.length === 0 ? (
              <div className="empty-state">No posts</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Track</th>
                    <th>Scheduled</th>
                    <th>Status</th>
                    <th>Performance</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map(p => (
                    <tr key={p.id}>
                      <td className="text-sm" style={{ fontWeight: 500 }}>{p.platform}</td>
                      <td className="text-sm">{p.track}</td>
                      <td className="text-sm text-muted">{new Date(p.scheduled_at).toLocaleString()}</td>
                      <td><span className={`badge ${p.status === 'posted' ? 'badge-success' : 'badge-info'}`}>{p.status}</span></td>
                      <td className="text-sm text-muted">{p.views} views • {p.likes} likes</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Captions Tab */}
      {tab === 'captions' && (
        <div className="card">
          <div className="card-header">
            <h3>Caption Pool</h3>
            <button className="btn btn-sm btn-primary" onClick={bulkUploadCaptions}>+ Bulk Upload</button>
          </div>

          <div style={{ padding: 16 }}>
            {captions.length === 0 ? (
              <div className="empty-state">No captions</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
                {captions.map(cap => (
                  <div key={cap.id} style={{ padding: 12, backgroundColor: '#f9fafb', borderRadius: 4, border: '1px solid #e5e7eb' }}>
                    <div className="text-sm" style={{ marginBottom: 8 }}>{cap.caption}</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {\!cap.approved && (
                        <button className="btn btn-xs btn-success" onClick={() => approveCaption(cap.id)}>Approve</button>
                      )}
                      {cap.approved && <span className="text-xs text-success">✓ Approved</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Platforms Tab */}
      {tab === 'platforms' && (
        <div className="card">
          <div className="card-header">
            <h3>Connected Platforms</h3>
          </div>

          <div style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              {PLATFORMS.map(p => {
                const conn = connections.find(c => c.platform === p);
                return (
                  <div key={p} style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 8, backgroundColor: conn?.connected ? '#f0fdf4' : '#f9fafb' }}>
                    <h4 style={{ marginBottom: 8, textTransform: 'capitalize' }}>{p.replace(/_/g, ' ')}</h4>
                    {conn?.connected ? (
                      <div>
                        <div className="text-xs text-success">✓ Connected</div>
                        <div className="text-xs text-muted" style={{ marginTop: 4 }}>by {conn.connected_by_name}</div>
                      </div>
                    ) : (
                      <button className="btn btn-sm btn-primary" onClick={() => openConnectPlatform(p)}>Connect</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Autopilot Tab */}
      {tab === 'autopilot' && (
        <div className="card">
          <div className="card-header">
            <h3>Autopilot Schedules</h3>
            <button className="btn btn-sm btn-primary" onClick={openCreateSchedule}>+ New Schedule</button>
          </div>

          <div className="table-wrap">
            {schedules.length === 0 ? (
              <div className="empty-state">No autopilot schedules</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Platform</th>
                    <th>Post Time</th>
                    <th>Randomize Caption</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.platform}</td>
                      <td className="text-mono">{s.post_time}</td>
                      <td className="text-sm">{s.randomize_caption ? 'Yes' : 'No'}</td>
                      <td><span className={`badge ${s.enabled ? 'badge-success' : 'badge-secondary'}`}>{s.enabled ? 'Enabled' : 'Disabled'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Schedule Post Modal */}
      {modal === 'schedule' && form && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>Schedule Post</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="form-grid cols-1">
              <div className="form-group">
                <label>Platform*</label>
                <select className="input" value={form.platform}
                  onChange={e => setForm({ ...form, platform: e.target.value })}>
                  {PLATFORMS.filter(p => p \!== 'google_my_business').map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Track*</label>
                <select className="input" value={form.track}
                  onChange={e => setForm({ ...form, track: e.target.value })}>
                  {TRACKS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Schedule Date/Time*</label>
                <input type="datetime-local" className="input" value={form.scheduled_at}
                  onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Caption</label>
                <textarea className="input" rows={3} value={form.caption}
                  onChange={e => setForm({ ...form, caption: e.target.value })} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={schedulePost}>Schedule</button>
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connect Platform Modal */}
      {modal === 'connect' && form && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>Connect {form.platform}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="form-grid cols-1">
              <div className="form-group">
                <label>Access Token</label>
                <input type="password" className="input" value={form.access_token}
                  onChange={e => setForm({ ...form, access_token: e.target.value })}
                  placeholder="OAuth token from platform" />
              </div>

              <div className="form-group">
                <label>Business Account ID</label>
                <input className="input" value={form.business_account_id}
                  onChange={e => setForm({ ...form, business_account_id: e.target.value })} />
              </div>

              <div className="form-group">
                <label>Page ID</label>
                <input className="input" value={form.page_id}
                  onChange={e => setForm({ ...form, page_id: e.target.value })} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={connectPlatform}>Connect</button>
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Autopilot Schedule Modal */}
      {modal === 'new-schedule' && form && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>New Autopilot Schedule</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="form-grid cols-1">
              <div className="form-group">
                <label>Platform*</label>
                <select className="input" value={form.platform}
                  onChange={e => setForm({ ...form, platform: e.target.value })}>
                  {PLATFORMS.filter(p => p \!== 'google_my_business').map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Post Time*</label>
                <input type="time" className="input" value={form.post_time}
                  onChange={e => setForm({ ...form, post_time: e.target.value })} />
              </div>

              <div className="form-group">
                <label>
                  <input type="checkbox" checked={form.randomize_caption}
                    onChange={e => setForm({ ...form, randomize_caption: e.target.checked })} />
                  Randomize caption from pool
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary" onClick={createSchedule}>Create</button>
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
