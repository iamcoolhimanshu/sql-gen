import React from 'react';
import './ResultsTable.css';

export default function ResultsTable({ results, onPageChange, currentPage }) {
  const { rows, fields, rowCount, total, totalPages, executionTimeMs } = results;

  if (!rows || rows.length === 0) {
    return (
      <div className="results-empty">
        <span>📭</span>
        <p>Query returned 0 rows</p>
        <span className="exec-time">{executionTimeMs}ms</span>
      </div>
    );
  }

  return (
    <div className="results-wrap">
      <div className="results-header">
        <div className="results-stats">
          <span className="badge badge-green">{rowCount} rows</span>
          {total && total !== rowCount && <span className="badge badge-blue">{total.toLocaleString()} total</span>}
          <span className="exec-time">⚡ {executionTimeMs}ms</span>
        </div>
        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-ghost btn-sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
              ‹ Prev
            </button>
            <span className="page-info">Page {currentPage} of {totalPages}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages}>
              Next ›
            </button>
          </div>
        )}
      </div>

      <div className="table-scroll">
        <table className="results-table">
          <thead>
            <tr>
              <th className="row-num">#</th>
              {fields.map(f => (
                <th key={f.name}>{f.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="row-num">{(currentPage - 1) * 50 + i + 1}</td>
                {fields.map(f => {
                  const val = row[f.name];
                  const isNull = val === null || val === undefined;
                  const display = isNull ? 'NULL' : typeof val === 'object' ? JSON.stringify(val) : String(val);
                  const isLong = display.length > 60;
                  return (
                    <td key={f.name} className={`${isNull ? 'cell-null' : ''} ${isLong ? 'cell-long' : ''}`}>
                      <span title={display}>{isNull ? <em>NULL</em> : isLong ? display.slice(0, 60) + '…' : display}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
