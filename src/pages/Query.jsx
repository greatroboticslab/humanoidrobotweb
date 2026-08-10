import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Query.css';

const PAGE_SIZE = 25;

// values the backend understands as booleans
const BOOL_OPTIONS = [
  { value: 'true', label: 'yes' },
  { value: 'false', label: 'no' },
];

function newFilter(fields) {
  const first = Object.keys(fields)[0];
  return { id: Math.random().toString(36).slice(2), field: first, op: 'eq', value: '' };
}

// operators the backend will accept for a given field type
function opsFor(operators, type) {
  return Object.entries(operators)
    .filter(([, spec]) => spec.types.includes(type))
    .map(([key, spec]) => ({ key, label: spec.label }));
}

function cellText(value, type) {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (type === 'date') {
    const d = new Date(value);
    if (!isNaN(d)) {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
  }
  return String(value);
}

function toCsv(columns, rows) {
  const escape = (v) => {
    const s = Array.isArray(v) ? v.join('; ') : v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    columns.join(','),
    ...rows.map(r => columns.map(c => escape(r[c])).join(',')),
  ].join('\n');
}

function Query() {
  const { role, refresh } = useAuth();
  const [schema, setSchema] = useState(null);
  const [source, setSource] = useState(null);
  const [filters, setFilters] = useState([]);
  const [combinator, setCombinator] = useState('and');
  const [sort, setSort] = useState('');
  const [page, setPage] = useState(0);

  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [viewJson, setViewJson] = useState(false);
  const [editingRow, setEditingRow] = useState(null);   // _row_id being edited
  const [draft, setDraft] = useState({});               // pending field values
  const [busyRow, setBusyRow] = useState(null);         // _row_id mid-request
  const [notice, setNotice] = useState(null);

  // load the queryable sources and their fields
  useEffect(() => {
    fetch('/api/query/schema')
      .then(res => {
        // session expired or role changed while the tab sat open, so re-read it
        // and let RequireRole show the right gate instead of a bare error
        if (res.status === 401 || res.status === 403) {
          refresh();
          throw new Error('Your session has changed. Reloading your access...');
        }
        if (!res.ok) throw new Error('Could not load the query schema.');
        return res.json();
      })
      .then(data => {
        setSchema(data);
        const first = data.sources[0];
        setSource(first.key);
        setSort(first.default_sort);
      })
      .catch(err => setError(err.message));
  }, [refresh]);

  const sourceSpec = schema ? schema.sources.find(s => s.key === source) : null;

  const runQuery = useCallback(async (nextPage = 0) => {
    if (!sourceSpec) return;
    setRunning(true);
    setError(null);
    setNotice(null);
    setEditingRow(null);
    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source,
          combinator,
          sort,
          limit: PAGE_SIZE,
          skip: nextPage * PAGE_SIZE,
          filters: filters.map(({ field, op, value }) => ({ field, op, value })),
        }),
      });
      if (res.status === 401 || res.status === 403) {
        refresh();
        setError('Your session has changed. Reloading your access...');
        setResult(null);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Query failed.');
        setResult(null);
        return;
      }
      setResult(data);
      setPage(nextPage);
    } catch {
      setError('Could not reach the server.');
      setResult(null);
    } finally {
      setRunning(false);
    }
  }, [source, sourceSpec, filters, combinator, sort, refresh]);

  // run once as soon as a source is picked, so the page isn't empty on arrival
  useEffect(() => {
    if (sourceSpec) runQuery(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const switchSource = (spec) => {
    setSource(spec.key);
    setFilters([]);
    setSort(spec.default_sort);
    setResult(null);
    setPage(0);
    setEditingRow(null);
    setNotice(null);
  };

  const startEdit = (row) => {
    setEditingRow(row._row_id);
    setDraft(
      Object.fromEntries(result.editable.map(f => [f, row[f] ?? '']))
    );
  };

  const saveEdit = async (row) => {
    setBusyRow(row._row_id);
    setError(null);
    try {
      const res = await fetch(`/api/query/${source}/${encodeURIComponent(row._row_id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (res.status === 401 || res.status === 403) {
        refresh();
        setError('Your session has changed. Reloading your access...');
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not save those changes.');
        return;
      }
      // patch the row in place rather than re-running the whole query
      setResult(prev => ({
        ...prev,
        rows: prev.rows.map(r =>
          r._row_id === row._row_id ? { ...r, ...data.updated } : r
        ),
      }));
      setEditingRow(null);
      setNotice('Saved.');
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusyRow(null);
    }
  };

  const deleteRow = async (row) => {
    const label = row.video_id || row.name || row._row_id;
    const extra = result.cascade.length
      ? `\n\nThis also deletes its ${result.cascade.join(', ')} records and any recordings attached to them.`
      : '';
    if (!window.confirm(`Delete "${label}"?${extra}\n\nThis cannot be undone.`)) return;

    setBusyRow(row._row_id);
    setError(null);
    try {
      const res = await fetch(`/api/query/${source}/${encodeURIComponent(row._row_id)}`, {
        method: 'DELETE',
      });
      if (res.status === 401 || res.status === 403) {
        refresh();
        setError('Your session has changed. Reloading your access...');
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not delete that row.');
        return;
      }
      const summary = Object.entries(data.removed)
        .map(([coll, n]) => `${n} from ${coll}`)
        .join(', ');
      setResult(prev => ({
        ...prev,
        rows: prev.rows.filter(r => r._row_id !== row._row_id),
        total: prev.total - 1,
      }));
      setNotice(`Deleted ${summary}.`);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusyRow(null);
    }
  };

  const updateFilter = (id, patch) => {
    setFilters(prev => prev.map(f => {
      if (f.id !== id) return f;
      const next = { ...f, ...patch };
      // switching field can invalidate the operator, so fall back to "is"
      if (patch.field) {
        const type = sourceSpec.fields[patch.field].type;
        const allowed = opsFor(schema.operators, type).map(o => o.key);
        if (!allowed.includes(next.op)) next.op = allowed[0];
        next.value = '';
      }
      return next;
    }));
  };

  const downloadCsv = () => {
    const blob = new Blob([toCsv(result.columns, result.rows)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${source}-page${page + 1}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error && !schema) {
    return <div className="query-page"><div className="query-error">{error}</div></div>;
  }
  if (!schema || !sourceSpec) {
    return <div className="loading">Loading query interface...</div>;
  }

  const totalPages = result ? Math.ceil(result.total / PAGE_SIZE) : 0;
  // developers get a read-only table; the backend decides, not the UI
  const showActions = !!result && (result.deletable || result.editable.length > 0);

  return (
    <div className="query-page">
      <div className="query-header">
        <div>
          <h2>Data Query</h2>
          <p>
            Filter the pipeline collections directly. Available to the{' '}
            <strong>developer</strong> and <strong>admin</strong> roles.
          </p>
        </div>
        <span className={`role-pill role-${role}`}>{role}</span>
      </div>

      {/* pick a collection */}
      <div className="source-tabs">
        {schema.sources.map(spec => (
          <button
            key={spec.key}
            className={`source-tab ${source === spec.key ? 'active' : ''}`}
            onClick={() => switchSource(spec)}
          >
            <span className="source-tab-label">{spec.label}</span>
            <span className="source-tab-desc">{spec.description}</span>
          </button>
        ))}
      </div>

      {/* filter builder */}
      <div className="query-builder">
        <div className="query-builder-head">
          <h3>Filters</h3>
          {filters.length > 1 && (
            <div className="combinator-toggle">
              <button
                className={combinator === 'and' ? 'active' : ''}
                onClick={() => setCombinator('and')}
              >
                Match all
              </button>
              <button
                className={combinator === 'or' ? 'active' : ''}
                onClick={() => setCombinator('or')}
              >
                Match any
              </button>
            </div>
          )}
        </div>

        {filters.length === 0 && (
          <p className="query-hint">No filters — showing everything in this collection.</p>
        )}

        {filters.map(f => {
          const spec = sourceSpec.fields[f.field];
          const ops = opsFor(schema.operators, spec.type);
          return (
            <div className="filter-row" key={f.id}>
              <select
                value={f.field}
                onChange={e => updateFilter(f.id, { field: e.target.value })}
              >
                {Object.entries(sourceSpec.fields).map(([name, s]) => (
                  <option key={name} value={name}>{s.label}</option>
                ))}
              </select>

              <select
                value={f.op}
                onChange={e => updateFilter(f.id, { op: e.target.value })}
              >
                {ops.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>

              {f.op === 'exists' || spec.type === 'boolean' ? (
                <select
                  value={f.value === '' ? 'true' : String(f.value)}
                  onChange={e => updateFilter(f.id, { value: e.target.value })}
                >
                  {BOOL_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : spec.type === 'enum' && f.op !== 'in' ? (
                <select
                  value={f.value}
                  onChange={e => updateFilter(f.id, { value: e.target.value })}
                >
                  <option value="">Choose...</option>
                  {spec.options.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={spec.type === 'number' ? 'number' : 'text'}
                  value={f.value}
                  placeholder={
                    f.op === 'in' ? 'comma, separated, values'
                      : spec.type === 'date' ? 'e.g. 2025-07'
                      : 'value'
                  }
                  onChange={e => updateFilter(f.id, { value: e.target.value })}
                />
              )}

              <button
                className="filter-remove"
                title="Remove filter"
                onClick={() => setFilters(prev => prev.filter(x => x.id !== f.id))}
              >
                &times;
              </button>
            </div>
          );
        })}

        <div className="query-actions">
          <button
            className="add-filter-btn"
            onClick={() => setFilters(prev => [...prev, newFilter(sourceSpec.fields)])}
          >
            + Add filter
          </button>

          <div className="sort-control">
            <label>Sort by</label>
            <select value={sort} onChange={e => setSort(e.target.value)}>
              {Object.entries(sourceSpec.fields).flatMap(([name, s]) => [
                <option key={name} value={name}>{s.label} ↑</option>,
                <option key={`-${name}`} value={`-${name}`}>{s.label} ↓</option>,
              ])}
            </select>
          </div>

          <button className="run-query-btn" onClick={() => runQuery(0)} disabled={running}>
            {running ? 'Running...' : 'Run query'}
          </button>
        </div>
      </div>

      {error && <div className="query-error">{error}</div>}
      {notice && <div className="query-notice">{notice}</div>}

      {/* results */}
      {result && (
        <div className="query-results">
          <div className="results-head">
            <span className="results-count">
              {result.total.toLocaleString()} {result.total === 1 ? 'result' : 'results'}
              {result.total > 0 && (
                <span className="results-range">
                  {' '}· showing {result.skip + 1}–{result.skip + result.rows.length}
                </span>
              )}
            </span>
            <div className="results-tools">
              <button
                className={`view-toggle ${viewJson ? '' : 'active'}`}
                onClick={() => setViewJson(false)}
              >
                Table
              </button>
              <button
                className={`view-toggle ${viewJson ? 'active' : ''}`}
                onClick={() => setViewJson(true)}
              >
                JSON
              </button>
              <button
                className="export-btn"
                onClick={downloadCsv}
                disabled={result.rows.length === 0}
              >
                Export CSV
              </button>
            </div>
          </div>

          {result.rows.length === 0 ? (
            <p className="query-empty">Nothing matched those filters.</p>
          ) : viewJson ? (
            <pre className="results-json">{JSON.stringify(result.rows, null, 2)}</pre>
          ) : (
            <div className="results-table-wrap">
              <table className="results-table">
                <thead>
                  <tr>
                    {result.columns.map(c => (
                      <th key={c}>{result.fields[c]?.label || c}</th>
                    ))}
                    {showActions && <th className="actions-col">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map(row => {
                    const editing = editingRow === row._row_id;
                    const busy = busyRow === row._row_id;
                    return (
                      <tr key={row._row_id} className={editing ? 'row-editing' : ''}>
                        {result.columns.map(c => {
                          const shown = cellText(row[c], result.fields[c]?.type);
                          const canEditCell = editing && result.editable.includes(c);
                          return (
                            <td key={c} title={canEditCell ? undefined : shown}>
                              {canEditCell ? (
                                <input
                                  className="cell-input"
                                  value={draft[c] ?? ''}
                                  onChange={e => setDraft(d => ({ ...d, [c]: e.target.value }))}
                                />
                              ) : c === 'video_id' && row[c] ? (
                                <Link to={`/dataset/${row[c]}`}>{row[c]}</Link>
                              ) : (
                                shown
                              )}
                            </td>
                          );
                        })}
                        {showActions && (
                          <td className="actions-col">
                            {editing ? (
                              <div className="row-actions">
                                <button
                                  className="row-btn save"
                                  disabled={busy}
                                  onClick={() => saveEdit(row)}
                                >
                                  {busy ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  className="row-btn"
                                  disabled={busy}
                                  onClick={() => setEditingRow(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="row-actions">
                                {result.editable.length > 0 && (
                                  <button className="row-btn" onClick={() => startEdit(row)}>
                                    Edit
                                  </button>
                                )}
                                {result.deletable && (
                                  <button
                                    className="row-btn delete"
                                    disabled={busy}
                                    onClick={() => deleteRow(row)}
                                  >
                                    {busy ? '...' : 'Delete'}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="results-pagination">
              <button onClick={() => runQuery(page - 1)} disabled={page === 0 || running}>
                Previous
              </button>
              <span>Page {page + 1} of {totalPages}</span>
              <button
                onClick={() => runQuery(page + 1)}
                disabled={page + 1 >= totalPages || running}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Query;
