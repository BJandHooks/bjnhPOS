import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useToast } from '../hooks/useToast';

export default function OnlineStore() {
  const { show, Toast } = useToast();
  const [tab, setTab] = useState('settings');
  const [settings, setSettings] = useState(null);
  const [onlineItems, setOnlineItems] = useState([]);
  const [listings, setListings] = useState([]);
  const [syncHistory, setSyncHistory] = useState([]);
  const [monitoring, setMonitoring] = useState([]);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [modal, setModal] = useState(null);

  useEffect(() => { loadAllData(); }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [settingsRes, itemsRes, listingsRes, historyRes, monRes, backupRes] = await Promise.all([
        api.get('/online-store/settings'),
        api.get('/online-store/inventory-status'),
        api.get('/online-store/listings'),
        api.get('/online-store/sync-history'),
        api.get('/online-store/monitoring'),
        api.get('/online-store/backups')
      ]);
      setSettings(settingsRes.data);
      setOnlineItems(itemsRes.data);
      setListings(listingsRes.data);
      setSyncHistory(historyRes.data);
      setMonitoring(monRes.data);
      setBackups(backupRes.data);
      setForm(settingsRes.data);
    } catch {
      show('Failed to load data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      await api.patch('/online-store/settings', form);
      show('Settings saved.', 'success');
      loadAllData();
    } catch {
      show('Failed to save settings.', 'error');
    }
  };

  const syncPlatform = async (platform) => {
    try {
      await api.post('/online-store/sync', { platform, sync_type: 'inventory' });
      show(`Syncing ${platform}...`, 'success');
      setTimeout(loadAllData, 2000);
    } catch {
      show('Sync failed.', 'error');
    }
  };

  const regenerateFeed = async () => {
    try {
      const res = await api.post('/online-store/regenerate-feed', {});
      show(`Google Shopping feed regenerated: ${res.data.items_generated} items.`, 'success');
    } catch {
      show('Failed to regenerate feed.', 'error');
    }
  };

  const runHealthCheck = async () => {
    try {
      await api.post('/online-store/run-health-check', {});
      show('Health check complete.', 'success');
      loadAllData();
    } catch {
      show('Health check failed.', 'error');
    }
  };

  const createBackup = async (type) => {
    try {
      await api.post('/online-store/backup', { backup_type: type });
      show('Backup created.', 'success');
      loadAllData();
    } catch {
      show('Backup failed.', 'error');
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
        <h2>Online Store & Sync</h2>
        <span className="text-sm text-muted">E-commerce and platform integration</span>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <TabButton name="settings" label="Settings" />
        <TabButton name="inventory" label="Online Inventory" />
        <TabButton name="sync" label="Platform Sync" />
        <TabButton name="monitoring" label="Health" />
        <TabButton name="backups" label="Backups" />
      </div>

      {/* Settings Tab */}
      {tab === 'settings' && form && (
        <div className="card">
          <div className="card-header">
            <h3>Online Store Settings</h3>
          </div>
          <div className="form-grid cols-2" style={{ padding: 16 }}>
            <div className="form-group cols-2">
              <label>
                <input type="checkbox" checked={form.store_enabled}
                  onChange={e => setForm({ ...form, store_enabled: e.target.checked })} />
                Enable Online Store
              </label>
            </div>

            <div className="form-group">
              <label>Store URL</label>
              <input className="input" value={form.store_url || ''}
                onChange={e => setForm({ ...form, store_url: e.target.value })}
                placeholder="https://yourstore.com" />
            </div>

            <div className="form-group">
              <label>Store Theme</label>
              <select className="input" value={form.store_theme || ''}
                onChange={e => setForm({ ...form, store_theme: e.target.value })}>
                <option value="">Default</option>
                <option value="minimal">Minimal</option>
                <option value="dark">Dark</option>
                <option value="vintage">Vintage</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, gridColumn: '1 / -1' }}>
              <button className="btn btn-primary" onClick={saveSettings}>Save Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {tab === 'inventory' && (
        <div className="card">
          <div className="card-header">
            <h3>Online Inventory</h3>
            <span className="text-muted text-sm">{onlineItems.length} items listed</span>
          </div>

          <div className="table-wrap">
            {onlineItems.length === 0 ? (
              <div className="empty-state">No items online</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Price</th>
                    <th>Platforms</th>
                    <th>Status</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {onlineItems.map(item => (
                    <tr key={item.inventory_id}>
                      <td style={{ fontWeight: 500 }}>{item.title}</td>
                      <td className="text-mono">${parseFloat(item.price).toFixed(2)}</td>
                      <td className="text-sm">
                        {item.online_platforms.split(',').map((p, i) => (
                          <span key={i} className="badge badge-info" style={{ marginRight: 4 }}>
                            {p}
                          </span>
                        ))}
                      </td>
                      <td className="text-sm">
                        {item.is_online ? (
                          <span style={{ color: '#059669' }}>✓ Online</span>
                        ) : (
                          <span className="text-muted">Offline</span>
                        )}
                      </td>
                      <td className="text-sm text-muted">{new Date(item.updated_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Sync Tab */}
      {tab === 'sync' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h3>Platform Sync</h3>
            </div>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <button className="btn btn-primary" onClick={() => syncPlatform('discogs')}>Sync Discogs</button>
              <button className="btn btn-primary" onClick={() => syncPlatform('ebay')}>Sync eBay</button>
              <button className="btn btn-primary" onClick={() => syncPlatform('etsy')}>Sync Etsy</button>
              <button className="btn btn-info" onClick={regenerateFeed}>Regenerate Google Feed</button>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Sync History</h3>
              <span className="text-muted text-sm">{syncHistory.length} jobs</span>
            </div>

            <div className="table-wrap">
              {syncHistory.length === 0 ? (
                <div className="empty-state">No sync jobs</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Records</th>
                      <th>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncHistory.map(job => (
                      <tr key={job.id}>
                        <td style={{ fontWeight: 500 }}>{job.platform}</td>
                        <td className="text-sm">{job.sync_type}</td>
                        <td>
                          <span className={`badge ${job.status === 'complete' ? 'badge-success' : job.status === 'failed' ? 'badge-danger' : 'badge-info'}`}>
                            {job.status}
                          </span>
                        </td>
                        <td className="text-mono">{job.records_synced}</td>
                        <td className="text-sm text-muted">{job.completed_at ? new Date(job.completed_at).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Monitoring Tab */}
      {tab === 'monitoring' && (
        <div className="card">
          <div className="card-header">
            <h3>Website Health</h3>
            <button className="btn btn-sm btn-primary" onClick={runHealthCheck}>Run Health Check</button>
          </div>

          <div style={{ padding: 16 }}>
            {monitoring.length === 0 ? (
              <div className="empty-state">No health checks run yet</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                {monitoring.map(check => (
                  <div key={check.id} style={{ padding: 16, border: '1px solid #e5e7eb', borderRadius: 8, backgroundColor: check.status === 'ok' ? '#f0fdf4' : '#fef3c7' }}>
                    <h4 className="text-sm" style={{ marginBottom: 8, textTransform: 'capitalize' }}>
                      {check.check_type.replace(/_/g, ' ')}
                    </h4>
                    <div className={`badge ${check.status === 'ok' ? 'badge-success' : 'badge-warning'}`}>
                      {check.status}
                    </div>
                    {check.last_checked_at && (
                      <div className="text-xs text-muted" style={{ marginTop: 8 }}>
                        Last checked: {new Date(check.last_checked_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backups Tab */}
      {tab === 'backups' && (
        <div className="card">
          <div className="card-header">
            <h3>Automated Backups</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm btn-primary" onClick={() => createBackup('database')}>Backup Database</button>
              <button className="btn btn-sm btn-primary" onClick={() => createBackup('files')}>Backup Files</button>
            </div>
          </div>

          <div className="table-wrap">
            {backups.length === 0 ? (
              <div className="empty-state">No backups yet</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Size</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {backups.map(b => (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 500, textTransform: 'capitalize' }}>{b.backup_type}</td>
                      <td className="text-sm text-muted">{b.backup_size ? (b.backup_size / 1024 / 1024).toFixed(2) + ' MB' : '—'}</td>
                      <td><span className={`badge ${b.status === 'complete' ? 'badge-success' : 'badge-info'}`}>{b.status}</span></td>
                      <td className="text-sm text-muted">{new Date(b.backup_date).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
