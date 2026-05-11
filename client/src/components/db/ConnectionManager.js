import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { dbAPI } from '../../services/api';
import './ConnectionManager.css';

function ConnectionForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ name: '', host: 'localhost', port: '3306', database_name: '', username: 'postgres', password: '', ssl_enabled: false, port: '3306' });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await dbAPI.testConnection(form);
      setTestResult({ success: true, msg: 'Connected! ' + (res.data.version?.split(' ').slice(0,2).join(' ') || '') });
    } catch (err) {
      setTestResult({ success: false, msg: err.response?.data?.error || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.host || !form.database_name || !form.username) {
      return toast.error('Please fill all required fields');
    }
    setSaving(true);
    try {
      await dbAPI.addConnection(form);
      toast.success('Connection saved!');
      onSave();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="conn-form card animate-in">
      <h3 className="conn-form-title">New Connection</h3>
      <div className="conn-form-grid">
        <div className="form-group" style={{gridColumn:'1/-1'}}>
          <label className="form-label">Connection Name *</label>
          <input className="form-input" placeholder="e.g. Production DB" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Host *</label>
          <input className="form-input" placeholder="localhost" value={form.host} onChange={e => set('host', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Port</label>
          <input className="form-input" type="number" placeholder="3306" value={form.port} onChange={e => set('port', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Database *</label>
          <input className="form-input" placeholder="my_database" value={form.database_name} onChange={e => set('database_name', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Username *</label>
          <input className="form-input" placeholder="postgres" value={form.username} onChange={e => set('username', e.target.value)} />
        </div>
        <div className="form-group" style={{gridColumn:'1/-1'}}>
          <label className="form-label">Password</label>
          <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={e => set('password', e.target.value)} />
        </div>
        <div className="form-group" style={{gridColumn:'1/-1'}}>
          <label className="ssl-toggle">
            <input type="checkbox" checked={form.ssl_enabled} onChange={e => set('ssl_enabled', e.target.checked)} />
            <span>Enable SSL</span>
          </label>
        </div>
      </div>

      {testResult && (
        <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
          {testResult.success ? '✓' : '✗'} {testResult.msg}
        </div>
      )}

      <div className="conn-form-actions">
        <button className="btn btn-secondary" onClick={handleTest} disabled={testing}>
          {testing ? <><span className="spinner" style={{width:14,height:14}}/> Testing...</> : 'Test Connection'}
        </button>
        <div style={{display:'flex',gap:8}}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner" style={{width:14,height:14}}/> Saving...</> : 'Save Connection'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConnectionManager({ connections, onUpdate, onSelectConnection }) {
  const [showForm, setShowForm] = useState(false);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this connection?')) return;
    try {
      await dbAPI.deleteConnection(id);
      toast.success('Connection deleted');
      onUpdate();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="conn-manager">
      <div className="conn-manager-header">
        <div>
          <h2>Database Connections</h2>
          <p>Manage your PostgreSQL connections</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          New Connection
        </button>
      </div>

      {showForm && (
        <ConnectionForm
          onSave={() => { setShowForm(false); onUpdate(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="conn-grid">
        {connections.length === 0 && !showForm ? (
          <div className="conn-empty card">
            <div className="conn-empty-icon">🔌</div>
            <h3>No connections yet</h3>
            <p>Add your first PostgreSQL database connection to get started</p>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>Add Connection</button>
          </div>
        ) : (
          connections.map(conn => (
            <div key={conn.id} className="conn-card card" onClick={() => onSelectConnection(conn)}>
              <div className="conn-card-top">
                <div className="conn-card-icon">🗄️</div>
                <div className="conn-card-actions">
                  <button className="btn btn-danger btn-sm btn-icon" title="Delete" onClick={e => handleDelete(conn.id, e)}>
                    <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M1 3h12M5 3V2h4v1M3 3l1 9h6l1-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>
                </div>
              </div>
              <h3 className="conn-card-name">{conn.name}</h3>
              <div className="conn-card-details">
                <span className="badge badge-green">PostgreSQL</span>
                <code>{conn.username}@{conn.host}:{conn.port}/{conn.database_name}</code>
              </div>
              <button className="btn btn-secondary btn-sm" style={{marginTop:12, width:'100%', justifyContent:'center'}}
                onClick={e => { e.stopPropagation(); onSelectConnection(conn); }}>
                Use this connection →
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
