import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { queryAPI } from '../../services/api';
import './QueryHistory.css';

function EditModal({ query, onSave, onClose }) {
  const [sql, setSql] = useState(query.sql_query);
  const [name, setName] = useState(query.query_name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await queryAPI.updateQuery(query.id, { sql, queryName: name });
      toast.success('Query updated');
      onSave();
    } catch (err) {
      toast.error('Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-in" style={{maxWidth:600}}>
        <div className="modal-header">
          <h3>Edit Query</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Query name..." />
        </div>
        <div className="form-group">
          <label className="form-label">SQL</label>
          <textarea className="form-textarea" value={sql} onChange={e => setSql(e.target.value)} rows={8} />
        </div>
        <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function QueryHistory({ activeConnection }) {
  const [history, setHistory] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editingQuery, setEditingQuery] = useState(null);
  const [runningId, setRunningId] = useState(null);
  const [runResults, setRunResults] = useState({});

  const pageSize = 20;

  const loadHistory = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { limit: pageSize, offset: (p - 1) * pageSize };
      if (activeConnection) params.connectionId = activeConnection.id;
      const res = await queryAPI.getHistory(params);
      setHistory(res.data.history);
      setTotal(res.data.total);
      setPage(p);
    } catch (err) {
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [activeConnection]);

  useEffect(() => { loadHistory(1); }, [loadHistory]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this query?')) return;
    try {
      await queryAPI.deleteQuery(id);
      toast.success('Deleted');
      loadHistory(page);
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleRerun = async (query) => {
    if (!activeConnection) return toast.error('Select a connection first');
    setRunningId(query.id);
    try {
      const res = await queryAPI.run({ sql: query.sql_query, connectionId: activeConnection.id });
      setRunResults(prev => ({ ...prev, [query.id]: res.data }));
      toast.success(`Returned ${res.data.rowCount} rows`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Query failed');
    } finally {
      setRunningId(null);
    }
  };

  const filtered = history.filter(q =>
    !search ||
    q.sql_query?.toLowerCase().includes(search.toLowerCase()) ||
    q.query_name?.toLowerCase().includes(search.toLowerCase()) ||
    q.natural_language?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="history-page">
      <div className="history-header">
        <div>
          <h2>Query History</h2>
          <p>{total} saved queries</p>
        </div>
        <input
          className="form-input"
          style={{ maxWidth: 280 }}
          placeholder="Search queries..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="history-loading"><div className="spinner" style={{width:28,height:28}} /></div>
      ) : filtered.length === 0 ? (
        <div className="history-empty card">
          <span>📋</span>
          <h3>No saved queries</h3>
          <p>Run queries and save them to see them here</p>
        </div>
      ) : (
        <>
          <div className="history-list">
            {filtered.map(q => (
              <div key={q.id} className="history-item card">
                <div className="history-item-top">
                  <div className="history-item-meta">
                    {q.query_name && <h4 className="history-item-name">{q.query_name}</h4>}
                    {q.natural_language && <p className="history-item-nl">"{q.natural_language}"</p>}
                    <div className="history-item-badges">
                      {q.connection_name && <span className="badge badge-blue">{q.connection_name}</span>}
                      {q.execution_time_ms && <span className="badge badge-green">⚡ {q.execution_time_ms}ms</span>}
                      {q.row_count !== null && q.row_count !== undefined && <span className="badge badge-yellow">{q.row_count} rows</span>}
                      <span className="history-date">{new Date(q.created_at).toLocaleDateString()} {new Date(q.created_at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                  </div>
                  <div className="history-item-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingQuery(q)} title="Edit">
                      ✏️
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => handleRerun(q)} disabled={runningId === q.id || !activeConnection}>
                      {runningId === q.id ? <span className="spinner" style={{width:12,height:12}} /> : '▶ Rerun'}
                    </button>
                    <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(q.id)} title="Delete">
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M1 3h12M5 3V2h4v1M3 3l1 9h6l1-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </div>
                <pre className="history-sql">{q.sql_query}</pre>
                {runResults[q.id] && (
                  <div className="history-result-preview">
                    <span className="badge badge-green">{runResults[q.id].rowCount} rows returned</span>
                    <span className="exec-time">⚡ {runResults[q.id].executionTimeMs}ms</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="history-pagination">
              <button className="btn btn-ghost btn-sm" onClick={() => loadHistory(page - 1)} disabled={page <= 1}>‹ Prev</button>
              <span className="page-info">Page {page} of {totalPages}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => loadHistory(page + 1)} disabled={page >= totalPages}>Next ›</button>
            </div>
          )}
        </>
      )}

      {editingQuery && (
        <EditModal
          query={editingQuery}
          onSave={() => { setEditingQuery(null); loadHistory(page); }}
          onClose={() => setEditingQuery(null)}
        />
      )}
    </div>
  );
}
