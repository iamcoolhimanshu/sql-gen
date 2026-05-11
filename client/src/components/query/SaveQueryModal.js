import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { queryAPI } from '../../services/api';
import './SaveQueryModal.css';

export default function SaveQueryModal({ sql, naturalLanguage, connectionId, results, onClose }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await queryAPI.save({
        sql,
        naturalLanguage,
        connectionId,
        queryName: name || null,
        executionTimeMs: results?.executionTimeMs,
        rowCount: results?.rowCount,
      });
      toast.success('Query saved to history!');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal animate-in">
        <div className="modal-header">
          <h3>Save Query</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="form-group">
          <label className="form-label">Query Name <span style={{color:'var(--text-muted)'}}>optional</span></label>
          <input className="form-input" placeholder="e.g. Monthly active users" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className="modal-preview">
          <pre>{sql}</pre>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner" style={{width:14,height:14}}/> Saving...</> : 'Save Query'}
          </button>
        </div>
      </div>
    </div>
  );
}
