import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { useToast } from '../hooks/useToast';

const IMPORT_TYPES = [
  { value: 'consignors', label: 'Consignors', description: 'Import consignor profiles with split percentages' },
  { value: 'inventory', label: 'Inventory', description: 'Import product catalog items' },
  { value: 'customers', label: 'Customers', description: 'Import customer profiles' },
  { value: 'sales', label: 'Sales History', description: 'Import past sales records' }
];

export default function Imports() {
  const { show, Toast } = useToast();
  const [selectedType, setSelectedType] = useState('');
  const [csvData, setCsvData] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [errors, setErrors] = useState([]);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const res = await api.get('/imports/history');
      setHistory(res.data);
    } catch {
      show('Failed to load import history.', 'error');
    }
  };

  const downloadTemplate = async (type) => {
    try {
      const response = await api.get(`/imports/templates/${type}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `import-${type}.csv`;
      a.click();
      show('Template downloaded.', 'success');
    } catch {
      show('Failed to download template.', 'error');
    }
  };

  const handlePaste = async (e) => {
    const pasted = e.clipboardData?.getData('text');
    if (pasted) {
      setCsvData(pasted);
      show('CSV pasted from clipboard.', 'success');
    }
  };

  const previewData = () => {
    if (!csvData.trim()) {
      show('Please paste CSV data first.', 'error');
      return;
    }

    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const preview = [];

    for (let i = 1; i < Math.min(lines.length, 6); i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || '';
      });
      preview.push(row);
    }

    return { headers, preview, total: lines.length - 1 };
  };

  const submitImport = async () => {
    if (!selectedType) {
      show('Please select import type.', 'error');
      return;
    }
    if (!csvData.trim()) {
      show('Please paste CSV data.', 'error');
      return;
    }

    setImporting(true);
    try {
      const res = await api.post(`/imports/${selectedType}`, { csv_data: csvData });
      show(`Import complete: ${res.data.successCount} succeeded, ${res.data.errorCount} failed.`, 'success');
      setCsvData('');
      setSelectedType('');
      loadHistory();
    } catch {
      show('Import failed.', 'error');
    } finally {
      setImporting(false);
    }
  };

  const loadDetail = async (job) => {
    try {
      const errRes = await api.get(`/imports/history/${job.id}/errors`);
      setErrors(errRes.data);
      setDetail(job);
    } catch {
      show('Failed to load error details.', 'error');
    }
  };

  const preview = selectedType && csvData ? previewData() : null;

  return (
    <div className="main-content">
      {Toast}
      <div className="page-header">
        <h2>Bulk Data Import</h2>
        <span className="text-sm text-muted">Import existing data from CSV files</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
        {IMPORT_TYPES.map(type => (
          <div
            key={type.value}
            className="card"
            onClick={() => setSelectedType(type.value)}
            style={{ cursor: 'pointer', border: selectedType === type.value ? '2px solid #059669' : '', padding: 16 }}>
            <h4 style={{ marginBottom: 8 }}>{type.label}</h4>
            <p className="text-sm text-muted">{type.description}</p>
            <button
              className="btn btn-sm btn-ghost"
              onClick={e => { e.stopPropagation(); downloadTemplate(type.value); }}
              style={{ marginTop: 12 }}>
              Download Template
            </button>
          </div>
        ))}
      </div>

      {selectedType && (
        <div className="card">
          <div className="card-header">
            <h3>{IMPORT_TYPES.find(t => t.value === selectedType)?.label} Import</h3>
          </div>

          <div className="form-grid cols-1" style={{ padding: 16 }}>
            <div className="form-group">
              <label>Paste CSV Data</label>
              <textarea
                className="input"
                rows={8}
                placeholder="Paste your CSV data here (copy from Excel or Google Sheets)"
                value={csvData}
                onChange={e => setCsvData(e.target.value)}
                onPaste={handlePaste}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
              <div className="text-xs text-muted" style={{ marginTop: 8 }}>
                Include header row in first line. Paste from Excel or Google Sheets directly.
              </div>
            </div>

            {preview && (
              <div style={{ backgroundColor: '#f3f4f6', padding: 16, borderRadius: 4 }}>
                <h4 className="text-sm" style={{ marginBottom: 12 }}>Preview ({preview.total} rows)</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        {preview.headers.map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #d1d5db' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.preview.map((row, i) => (
                        <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                          {preview.headers.map(h => (
                            <td key={h} style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb' }}>
                              {row[h]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button
                className="btn btn-primary"
                onClick={submitImport}
                disabled={importing || !preview}>
                {importing ? 'Importing...' : 'Import Data'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setCsvData(''); setSelectedType(''); }}>
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h3>Import History</h3>
          <span className="text-muted text-sm">{history.length} imports</span>
        </div>

        <div className="table-wrap">
          {history.length === 0 ? (
            <div className="empty-state">No imports yet</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Total</th>
                  <th>Success</th>
                  <th>Failed</th>
                  <th>Status</th>
                  <th>By</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.map(job => (
                  <tr key={job.id}>
                    <td style={{ fontWeight: 500 }}>{job.import_type}</td>
                    <td className="text-mono">{job.total_records}</td>
                    <td className="text-mono" style={{ color: '#059669' }}>{job.successful_records}</td>
                    <td className="text-mono" style={{ color: job.failed_records > 0 ? '#dc2626' : 'inherit' }}>{job.failed_records}</td>
                    <td>
                      <span className={`badge ${job.status === 'complete' ? 'badge-success' : 'badge-info'}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="text-sm text-muted">{job.user_name}</td>
                    <td className="text-sm text-muted">{new Date(job.created_at).toLocaleDateString()}</td>
                    <td>
                      {job.failed_records > 0 && (
                        <button className="btn btn-sm btn-ghost" onClick={() => loadDetail(job)}>Errors</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Error detail modal */}
      {detail && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3>Import Errors - {detail.import_type}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {errors.length === 0 ? (
                <div className="empty-state">No errors</div>
              ) : (
                <div>
                  {errors.map((err, i) => (
                    <div key={i} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
                      <div className="text-sm">
                        <strong>Row {err.row_number}</strong>
                        {err.field_name && <span className="text-muted"> • {err.field_name}</span>}
                      </div>
                      <div className="text-sm text-danger" style={{ marginTop: 4, color: '#dc2626' }}>
                        {err.error_message}
                      </div>
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
