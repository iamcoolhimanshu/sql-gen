import React, { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { queryAPI } from '../../services/api';
import QueryBuilder from './QueryBuilder';
import ResultsTable from './ResultsTable';
import SaveQueryModal from './SaveQueryModal';
import './QueryWorkspace.css';

export default function QueryWorkspace({ activeConnection, schema }) {
  const [nlInput, setNlInput] = useState('');
  const [sql, setSql] = useState('');
  const [generating, setGenerating] = useState(false);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [genMethod, setGenMethod] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [page, setPage] = useState(1);
  const textareaRef = useRef();

  const handleGenerate = async () => {
    if (!nlInput.trim()) return toast.error('Enter a natural language query');
    if (!activeConnection) return toast.error('Select a database connection first');
    setGenerating(true);
    setError(null);
    try {
      const res = await queryAPI.generate({ naturalLanguage: nlInput, connectionId: activeConnection.id });
      setSql(res.data.sql);
      setGenMethod(res.data.method);
      toast.success(`Query generated (${res.data.method})`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleRun = async (pageNum = 1) => {
    if (!sql.trim()) return toast.error('No SQL to run');
    if (!activeConnection) return toast.error('Select a database connection first');
    setRunning(true);
    setError(null);
    setPage(pageNum);
    try {
      const res = await queryAPI.run({ sql, connectionId: activeConnection.id, page: pageNum, pageSize: 50 });
      setResults(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Query failed');
      setResults(null);
    } finally {
      setRunning(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleGenerate();
  };

  const exampleQueries = [
    'Show me the last 10 users',
    'Count records by status',
    'Find all active entries',
    'Get the most recent 5 records',
  ];

  return (
    <div className="workspace">
      {/* NL Input */}
      <div className="workspace-section nl-section">
        <div className="nl-header">
          <div className="nl-title">
            <span className="nl-badge">NL</span>
            Natural Language Query
          </div>
          {activeConnection ? (
            <span className="active-conn-badge">
              <span className="conn-dot-sm" />
              {activeConnection.name}
            </span>
          ) : (
            <span className="no-conn-badge">No connection selected</span>
          )}
        </div>
        <div className="nl-input-wrap">
          <textarea
            ref={textareaRef}
            className="nl-textarea"
            placeholder="Ask in plain English... e.g. &quot;Show me all users who signed up last week&quot;"
            value={nlInput}
            onChange={e => setNlInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
          />
          <div className="nl-hint">Ctrl+Enter to generate</div>
        </div>
        <div className="nl-examples">
          {exampleQueries.map(q => (
            <button key={q} className="example-chip" onClick={() => setNlInput(q)}>{q}</button>
          ))}
        </div>
        <div className="nl-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowBuilder(v => !v)}>
            {showBuilder ? 'Hide' : 'Show'} Query Builder
          </button>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating || !activeConnection}>
            {generating
              ? <><span className="spinner" style={{width:14,height:14}}/> Generating...</>
              : <><span>✨</span> Generate SQL</>}
          </button>
        </div>
      </div>

      {/* Query Builder */}
      {showBuilder && (
        <div className="workspace-section">
          <QueryBuilder schema={schema} onSQL={setSql} />
        </div>
      )}

      {/* SQL Editor */}
      <div className="workspace-section sql-section">
        <div className="sql-header">
          <div className="sql-title">
            SQL Query
            {genMethod && <span className={`badge ${genMethod === 'ai' ? 'badge-purple' : 'badge-blue'}`}>{genMethod}</span>}
          </div>
          <div className="sql-actions">
            {sql && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard.writeText(sql); toast.success('Copied!'); }}>Copy</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowSaveModal(true)}>Save</button>
              </>
            )}
            <button className="btn btn-primary" onClick={() => handleRun(1)} disabled={running || !sql || !activeConnection}>
              {running ? <><span className="spinner" style={{width:14,height:14}}/> Running...</> : <><span>▶</span> Run</>}
            </button>
          </div>
        </div>
        <textarea
          className="sql-editor"
          value={sql}
          onChange={e => setSql(e.target.value)}
          placeholder="Generated SQL will appear here, or write your own SELECT query..."
          spellCheck={false}
        />
      </div>

      {/* Results */}
      {error && (
        <div className="workspace-section">
          <div className="query-error">
            <span className="query-error-icon">⚠</span>
            <div>
              <strong>Query Error</strong>
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}

      {results && !error && (
        <div className="workspace-section">
          <ResultsTable
            results={results}
            onPageChange={(p) => handleRun(p)}
            currentPage={page}
          />
        </div>
      )}

      {showSaveModal && (
        <SaveQueryModal
          sql={sql}
          naturalLanguage={nlInput}
          connectionId={activeConnection?.id}
          results={results}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}
