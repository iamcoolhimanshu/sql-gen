import React, { useState } from 'react';
import './Sidebar.css';

function SchemaTable({ table }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="schema-table">
      <button className="schema-table-header" onClick={() => setExpanded(v => !v)}>
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ transform: expanded ? 'rotate(90deg)' : '', transition: 'transform 0.18s' }}>
          <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
        </svg>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="3" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M1 6h12" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M5 3v8" stroke="currentColor" strokeWidth="1.3"/>
        </svg>
        <span className="schema-table-name">{table.name}</span>
        <span className="schema-table-count">{table.columns.length}</span>
      </button>
      {expanded && (
        <div className="schema-columns">
          {table.columns.map(col => (
            <div key={col.name} className="schema-col">
              <span className="schema-col-icons">
                {col.isPrimaryKey && <span title="Primary Key" className="key-icon pk">PK</span>}
                {col.isForeignKey && <span title="Foreign Key" className="key-icon fk">FK</span>}
              </span>
              <span className="schema-col-name">{col.name}</span>
              <span className="schema-col-type">{col.type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ connections, activeConnection, onSelectConnection, schema, schemaLoading, onAddConnection }) {
  const [search, setSearch] = useState('');

  const filteredSchema = schema.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.columns.some(c => c.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <aside className="sidebar">
      {/* Connections */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">
          <span>Databases</span>
          <button className="btn btn-ghost btn-icon" title="Add connection" onClick={onAddConnection}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="connections-list">
          {connections.length === 0 ? (
            <div className="sidebar-empty">
              <p>No connections yet</p>
              <button className="btn btn-primary btn-sm" onClick={onAddConnection}>Add connection</button>
            </div>
          ) : (
            connections.map(conn => (
              <button
                key={conn.id}
                className={`connection-item ${activeConnection?.id === conn.id ? 'active' : ''}`}
                onClick={() => onSelectConnection(conn)}
              >
                <div className="conn-dot" />
                <div className="conn-info">
                  <span className="conn-name">{conn.name}</span>
                  <span className="conn-detail">{conn.database_name}@{conn.host}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="sidebar-divider" />

      {/* Schema */}
      <div className="sidebar-section sidebar-schema">
        <div className="sidebar-section-header">
          <span>Schema</span>
          {schema.length > 0 && <span className="badge badge-blue">{schema.length} tables</span>}
        </div>

        {activeConnection ? (
          schemaLoading ? (
            <div className="sidebar-loading">
              <div className="spinner" />
              <span>Loading schema...</span>
            </div>
          ) : schema.length > 0 ? (
            <>
              <input
                className="form-input sidebar-search"
                placeholder="Search tables & columns..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <div className="schema-list">
                {filteredSchema.map(table => (
                  <SchemaTable key={`${table.schema}.${table.name}`} table={table} />
                ))}
              </div>
            </>
          ) : (
            <div className="sidebar-empty"><p>No tables found</p></div>
          )
        ) : (
          <div className="sidebar-empty"><p>Select a database to view its schema</p></div>
        )}
      </div>
    </aside>
  );
}
