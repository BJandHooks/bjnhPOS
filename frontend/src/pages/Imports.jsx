import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { useToast } from '../hooks/useToast';

const TYPES = [
  { value: 'inventory',   label: 'Inventory',     icon: '▦', desc: 'Products, records, and items for sale',     required: ['title','condition','price'] },
  { value: 'customers',   label: 'Customers',      icon: '◈', desc: 'Customer profiles and contact info',        required: ['name'] },
  { value: 'consignors',  label: 'Consignors',     icon: '◇', desc: 'Consignor profiles and split rates',       required: ['name','split_percentage'], ownerOnly: true },
  { value: 'users',       label: 'Staff / Users',  icon: '◑', desc: 'Staff accounts — passwords set to default', required: ['name','email','role'], ownerOnly: true },
  { value: 'work_orders', label: 'Work Orders',    icon: '⚙', desc: 'Repair and service jobs',                  required: ['job_type','description'] },
];

const STEP = { SELECT: 'select', PASTE: 'paste', PREVIEW: 'preview', RESULT: 'result' };

export default function Imports() {
  const { show, Toast } = useToast();
  const [step, setStep]                   = useState(STEP.SELECT);
  const [type, setType]                   = useState(null);
  const [csv, setCsv]                     = useState('');
  const [preview, setPreview]             = useState(null);
  const [prevLoading, setPrevLoading]     = useState(false);
  const [importing, setImporting]         = useState(false);
  const [result, setResult]               = useState(null);
  const [history, setHistory]             = useState([]);
  const [histLoading, setHistLoading]     = useState(true);
  const [errModal, setErrModal]           = useState(null);
  const [errRows, setErrRows]             = useState([]);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try { const r = await api.get('/imports/history'); setHistory(r.data); } catch {}
    finally { setHistLoading(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const downloadTemplate = async (t) => {
    try {
      const r = await api.get(`/imports/templates/${t}`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = `import-template-${t}.csv`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      show('Template downloaded.', 'success');
    } catch { show('Download failed.', 'error'); }
  };

  const handlePreview = async () => {
    if (\!csv.trim()) { show('Paste CSV data first.', 'error'); return; }
    setPrevLoading(true);
    try {
      const r = await api.post('/imports/preview', { csv_data: csv, type: type.value });
      setPreview(r.data);
      setStep(STEP.PREVIEW);
    } catch (e) { show(e.response?.data?.error || 'Preview failed.', 'error'); }
    finally { setPrevLoading(false); }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const r = await api.post(`/imports/${type.value}`, { csv_data: csv });
      setResult(r.data);
      setStep(STEP.RESULT);
      loadHistory();
      const { successCount: ok, errorCount: fail } = r.data;
      if (fail > 0 && ok > 0) show(`${ok} imported, ${fail} failed.`, 'info');
      else if (fail > 0)       show(`Import failed: ${fail} rows had errors.`, 'error');
      else                     show(`${ok} records imported successfully.`, 'success');
    } catch (e) { show(e.response?.data?.error || 'Import failed.', 'error'); }
    finally { setImporting(false); }
  };

  const reset = () => { setStep(STEP.SELECT); setType(null); setCsv(''); setPreview(null); setResult(null); };

  const openErrors = async (job) => {
    try {
      const r = await api.get(`/imports/history/${job.id}/errors`);
      setErrRows(r.data); setErrModal(job);
    } catch { show('Failed to load errors.', 'error'); }
  };

  const validRows  = preview ? preview.total_rows - preview.error_count : 0;

  return (
    <div className="main-content">
      {Toast}
      <div className="page-header">
        <div>
          <h2>Bulk Data Import</h2>
          <span className="text-sm text-muted">Import records from CSV into any module</span>
        </div>
      </div>

      {/* ── Step 1: choose module ── */}
      {step === STEP.SELECT && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))', gap:14, marginBottom:32 }}>
          {TYPES.map(t => (
            <div
              key={t.value}
              className="card"
              style={{ padding:18, cursor:'pointer' }}
              onClick={() => { setType(t); setStep(STEP.PASTE); }}
            >
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <span style={{ fontSize:14, fontWeight:600 }}>{t.icon} {t.label}</span>
                {t.ownerOnly && (
                  <span style={{ fontSize:10, background:'#fef3c7', color:'#92400e', padding:'2px 6px', borderRadius:10 }}>
                    Owner only
                  </span>
                )}
              </div>
              <p className="text-sm text-muted" style={{ margin:'0 0 10px' }}>{t.desc}</p>
              <div style={{ marginBottom:12 }}>
                <span className="text-xs text-muted">Required: </span>
                {t.required.map(c => (
                  <code key={c} style={{ fontSize:11, background:'#f3f4f6', padding:'1px 5px', borderRadius:3, marginRight:3 }}>{c}</code>
                ))}
              </div>
              <button
                className="btn btn-sm btn-ghost"
                style={{ width:'100%' }}
                onClick={e => { e.stopPropagation(); downloadTemplate(t.value); }}
              >
                ↓ Download Template
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Step 2: paste CSV ── */}
      {step === STEP.PASTE && type && (
        <div className="card" style={{ marginBottom:24 }}>
          <div className="card-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <h3 style={{ margin:0 }}>{type.icon} {type.label} — Paste CSV</h3>
              <span className="text-sm text-muted">
                Required columns: {type.required.map(c => <code key={c} style={{ marginLeft:4 }}>{c}</code>)}
              </span>
            </div>
            <button className="btn btn-sm btn-ghost" onClick={reset}>← Back</button>
          </div>
          <div style={{ padding:20 }}>
            <button className="btn btn-sm btn-ghost" style={{ marginBottom:14 }} onClick={() => downloadTemplate(type.value)}>
              ↓ Download Template
            </button>
            <div className="form-group">
              <label>Paste CSV Data</label>
              <textarea
                className="input"
                rows={10}
                value={csv}
                onChange={e => setCsv(e.target.value)}
                placeholder={`First row must be headers.\n\nExample:\n${type.required.join(',')}\n...`}
                style={{ fontFamily:'monospace', fontSize:12 }}
              />
              <div className="text-xs text-muted" style={{ marginTop:6 }}>
                Copy directly from Excel or Google Sheets (select all → copy → paste here).
              </div>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:16 }}>
              <button className="btn btn-primary" onClick={handlePreview} disabled={\!csv.trim() || prevLoading}>
                {prevLoading ? 'Checking…' : 'Preview & Validate →'}
              </button>
              <button className="btn btn-ghost" onClick={reset}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: preview + confirm ── */}
      {step === STEP.PREVIEW && preview && type && (
        <>
          <div className="card" style={{ marginBottom:16, padding:18 }}>
            <div style={{ display:'flex', gap:28, alignItems:'center', flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:12, color:'#6b7280' }}>Total rows</div>
                <div style={{ fontSize:24, fontWeight:700 }}>{preview.total_rows}</div>
              </div>
              <div>
                <div style={{ fontSize:12, color:'#059669' }}>Valid</div>
                <div style={{ fontSize:24, fontWeight:700, color:'#059669' }}>{validRows}</div>
              </div>
              <div>
                <div style={{ fontSize:12, color:'#dc2626' }}>Errors</div>
                <div style={{ fontSize:24, fontWeight:700, color: preview.error_count > 0 ? '#dc2626' : '#9ca3af' }}>
                  {preview.error_count}
                </div>
              </div>
              <div style={{ flex:1, display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setStep(STEP.PASTE)}>← Edit CSV</button>
                <button
                  className="btn btn-primary"
                  onClick={handleImport}
                  disabled={importing || validRows === 0}
                >
                  {importing ? 'Importing…' : `Import ${validRows} valid row${validRows \!== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>

            {preview.error_count > 0 && (
              <div style={{ marginTop:14, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:'10px 14px' }}>
                <strong style={{ fontSize:13, color:'#dc2626' }}>Validation errors (invalid rows will be skipped):</strong>
                <div style={{ marginTop:8 }}>
                  {Object.entries(preview.row_errors).map(([row, errs]) => (
                    <div key={row} style={{ fontSize:12, marginBottom:3 }}>
                      <strong>Row {row}:</strong> {errs.join('; ')}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {preview.preview.length > 0 && (
            <div className="card" style={{ marginBottom:16 }}>
              <div style={{ padding:'12px 16px 8px', fontWeight:600, fontSize:14 }}>
                Preview (first {preview.preview.length} rows)
              </div>
              <div className="table-wrap">
                <table style={{ fontSize:12 }}>
                  <thead>
                    <tr>{preview.headers.map(h => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((row, i) => (
                      <tr key={i} style={{ background: i % 2 ? '#fafafa' : 'white' }}>
                        {preview.headers.map(h => (
                          <td key={h} style={{ maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {row[h] ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Step 4: result ── */}
      {step === STEP.RESULT && result && (
        <div className="card" style={{ marginBottom:24, padding:28, textAlign:'center' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>
            {result.errorCount > 0 && result.successCount > 0 ? '⚠' : result.errorCount > 0 ? '✕' : '✓'}
          </div>
          <h3 style={{ margin:'0 0 18px' }}>Import Complete</h3>
          <div style={{ display:'flex', gap:32, justifyContent:'center', marginBottom:20 }}>
            <div>
              <div style={{ fontSize:32, fontWeight:700, color:'#059669' }}>{result.successCount}</div>
              <div style={{ fontSize:13, color:'#6b7280' }}>Imported</div>
            </div>
            <div>
              <div style={{ fontSize:32, fontWeight:700, color: result.errorCount > 0 ? '#dc2626' : '#9ca3af' }}>
                {result.errorCount}
              </div>
              <div style={{ fontSize:13, color:'#6b7280' }}>Failed</div>
            </div>
          </div>
          {result.row_errors && result.row_errors.length > 0 && (
            <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:'12px 16px', marginBottom:18, textAlign:'left' }}>
              <strong style={{ fontSize:13, color:'#dc2626' }}>Failed rows:</strong>
              {result.row_errors.map((re, i) => (
                <div key={i} style={{ fontSize:12, marginTop:5 }}>
                  <strong>Row {re.row}:</strong> {re.errors.join('; ')}
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-primary" onClick={reset}>Import Another File</button>
        </div>
      )}

      {/* ── History ── */}
      <div className="card" style={{ marginTop:24 }}>
        <div className="card-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3>Import History</h3>
          <button className="btn btn-sm btn-ghost" onClick={loadHistory}>↺ Refresh</button>
        </div>
        <div className="table-wrap">
          {histLoading ? (
            <div className="empty-state">Loading…</div>
          ) : history.length === 0 ? (
            <div className="empty-state">No imports yet</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Module</th><th>Total</th><th>Imported</th><th>Failed</th>
                  <th>Status</th><th>By</th><th>Date</th><th></th>
                </tr>
              </thead>
              <tbody>
                {history.map(job => (
                  <tr key={job.id}>
                    <td style={{ fontWeight:500, textTransform:'capitalize' }}>
                      {(job.import_type || '').replace('_', ' ')}
                    </td>
                    <td className="text-mono">{job.total_records}</td>
                    <td className="text-mono" style={{ color:'#059669' }}>{job.successful_records ?? 0}</td>
                    <td className="text-mono" style={{ color:(job.failed_records ?? 0) > 0 ? '#dc2626' : 'inherit' }}>
                      {job.failed_records ?? 0}
                    </td>
                    <td>
                      <span className={`badge ${job.status === 'complete' ? 'badge-success' : 'badge-info'}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="text-sm text-muted">{job.user_name || '—'}</td>
                    <td className="text-sm text-muted">{new Date(job.created_at).toLocaleDateString()}</td>
                    <td>
                      {(job.failed_records ?? 0) > 0 && (
                        <button className="btn btn-sm btn-ghost" onClick={() => openErrors(job)}>Errors</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Error detail modal ── */}
      {errModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setErrModal(null)}>
          <div className="modal" style={{ maxWidth:600 }}>
            <div className="modal-header">
              <h3>Import Errors — {(errModal.import_type || '').replace('_', ' ')}</h3>
              <button className="btn btn-sm btn-ghost" onClick={() => setErrModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight:'65vh', overflowY:'auto' }}>
              {errRows.length === 0 ? (
                <div className="empty-state">No error details found</div>
              ) : errRows.map((e, i) => (
                <div key={i} style={{ marginBottom:12, paddingBottom:12, borderBottom:'1px solid #e5e7eb' }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>
                    Row {e.row_number}
                    {e.field_name ? <span className="text-muted" style={{ fontWeight:400 }}> · {e.field_name}</span> : ''}
                  </div>
                  <div style={{ fontSize:13, color:'#dc2626', marginTop:2 }}>{e.error_message}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
