import React, { useState, useEffect } from 'react';
import './QueryBuilder.css';

const CONDITIONS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'ILIKE', 'IS NULL', 'IS NOT NULL', 'IN'];
const ORDER_DIRS = ['ASC', 'DESC'];

export default function QueryBuilder({ schema, onSQL }) {
  const [selectedTable, setSelectedTable] = useState('');
  const [selectedCols, setSelectedCols] = useState([]);
  const [wheres, setWheres] = useState([]);
  const [orderBy, setOrderBy] = useState({ col: '', dir: 'ASC' });
  const [limit, setLimit] = useState('50');
  const [joinTable, setJoinTable] = useState('');
  const [joinOn, setJoinOn] = useState('');

  const currentTable = schema.find(t => t.name === selectedTable);
  const cols = currentTable?.columns || [];

  useEffect(() => {
    if (!selectedTable) return;
    generateSQL();
  }, [selectedTable, selectedCols, wheres, orderBy, limit, joinTable, joinOn]);

  const generateSQL = () => {
    if (!selectedTable) return;
    const table = schema.find(t => t.name === selectedTable);
    if (!table) return;

    const colList = selectedCols.length > 0 ? selectedCols.map(c => `t1.${c}`).join(', ') : 't1.*';
    let sql = `SELECT ${colList}\nFROM ${table.schema}.${table.name} t1`;

    if (joinTable && joinOn) {
      const jt = schema.find(t => t.name === joinTable);
      if (jt) sql += `\nINNER JOIN ${jt.schema}.${jt.name} t2 ON ${joinOn}`;
    }

    const validWheres = wheres.filter(w => w.col && w.condition);
    if (validWheres.length > 0) {
      const clauses = validWheres.map(w => {
        if (w.condition === 'IS NULL' || w.condition === 'IS NOT NULL') return `t1.${w.col} ${w.condition}`;
        if (w.condition === 'IN') return `t1.${w.col} IN (${w.value})`;
        const val = isNaN(w.value) ? `'${w.value}'` : w.value;
        return `t1.${w.col} ${w.condition} ${val}`;
      });
      sql += `\nWHERE ${clauses.join('\n  AND ')}`;
    }

    if (orderBy.col) sql += `\nORDER BY t1.${orderBy.col} ${orderBy.dir}`;
    if (limit) sql += `\nLIMIT ${limit}`;
    sql += ';';

    onSQL(sql);
  };

  const addWhere = () => setWheres(w => [...w, { col: cols[0]?.name || '', condition: '=', value: '' }]);
  const removeWhere = (i) => setWheres(w => w.filter((_, idx) => idx !== i));
  const updateWhere = (i, key, val) => setWheres(w => w.map((item, idx) => idx === i ? { ...item, [key]: val } : item));

  const toggleCol = (col) => {
    setSelectedCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  return (
    <div className="query-builder">
      <h4 className="builder-title">Query Builder</h4>

      <div className="builder-row">
        <div className="form-group">
          <label className="form-label">Table</label>
          <select className="form-select" value={selectedTable} onChange={e => { setSelectedTable(e.target.value); setSelectedCols([]); setWheres([]); }}>
            <option value="">Select a table...</option>
            {schema.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Limit</label>
          <input className="form-input" type="number" value={limit} onChange={e => setLimit(e.target.value)} placeholder="50" min="1" max="10000" />
        </div>
      </div>

      {currentTable && (
        <>
          {/* Columns */}
          <div className="builder-group">
            <label className="form-label">Columns <span style={{color:'var(--text-muted)'}}>— click to select (empty = all)</span></label>
            <div className="col-chips">
              {cols.map(col => (
                <button
                  key={col.name}
                  className={`col-chip ${selectedCols.includes(col.name) ? 'selected' : ''}`}
                  onClick={() => toggleCol(col.name)}
                >
                  {col.isPrimaryKey && <span className="key-icon pk" style={{fontSize:9}}>PK</span>}
                  {col.name}
                  <span className="col-type">{col.type}</span>
                </button>
              ))}
            </div>
          </div>

          {/* WHERE */}
          <div className="builder-group">
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8}}>
              <label className="form-label">WHERE Conditions</label>
              <button className="btn btn-ghost btn-sm" onClick={addWhere}>+ Add condition</button>
            </div>
            {wheres.map((w, i) => (
              <div key={i} className="where-row">
                <select className="form-select" value={w.col} onChange={e => updateWhere(i, 'col', e.target.value)}>
                  {cols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                <select className="form-select" value={w.condition} onChange={e => updateWhere(i, 'condition', e.target.value)}>
                  {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {w.condition !== 'IS NULL' && w.condition !== 'IS NOT NULL' && (
                  <input className="form-input" placeholder="value" value={w.value} onChange={e => updateWhere(i, 'value', e.target.value)} />
                )}
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeWhere(i)}>✕</button>
              </div>
            ))}
          </div>

          {/* ORDER BY */}
          <div className="builder-row">
            <div className="form-group">
              <label className="form-label">Order By</label>
              <select className="form-select" value={orderBy.col} onChange={e => setOrderBy(o => ({ ...o, col: e.target.value }))}>
                <option value="">None</option>
                {cols.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Direction</label>
              <select className="form-select" value={orderBy.dir} onChange={e => setOrderBy(o => ({ ...o, dir: e.target.value }))}>
                {ORDER_DIRS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* JOIN */}
          {schema.length > 1 && (
            <div className="builder-group">
              <label className="form-label">JOIN (optional)</label>
              <div className="builder-row">
                <select className="form-select" value={joinTable} onChange={e => setJoinTable(e.target.value)}>
                  <option value="">No join</option>
                  {schema.filter(t => t.name !== selectedTable).map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                </select>
                {joinTable && (
                  <input className="form-input" placeholder="ON t1.id = t2.user_id" value={joinOn} onChange={e => setJoinOn(e.target.value)} />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
