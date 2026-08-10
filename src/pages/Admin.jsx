import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Admin.css';

const ROLES = ['user', 'developer', 'admin'];

const ROLE_BLURB = {
  user: 'Can browse the site and leave comments.',
  developer: 'Everything a user can do, plus the data query interface.',
  admin: 'Full access: query interface, user management, delete any comment.',
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function Admin() {
  const { user: me, refresh } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [savingSub, setSavingSub] = useState(null);

  useEffect(() => {
    fetch('/api/users')
      .then(res => {
        // session expired or role changed while the tab sat open, so re-read it
        // and let RequireRole show the right gate instead of a bare error
        if (res.status === 401 || res.status === 403) {
          refresh();
          throw new Error('Your session has changed. Reloading your access...');
        }
        if (!res.ok) throw new Error('Could not load users.');
        return res.json();
      })
      .then(data => setUsers(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [refresh]);

  const changeRole = async (sub, role) => {
    setSavingSub(sub);
    setError(null);
    try {
      const res = await fetch(`/api/users/${sub}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (res.status === 401 || res.status === 403) {
        refresh();
        setError('Your session has changed. Reloading your access...');
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not change that role.');
        return;
      }
      setUsers(prev => prev.map(u => (u.sub === sub ? { ...u, role: data.role } : u)));
      // if we just changed our own role, the navbar needs to catch up
      if (sub === me.sub) refresh();
    } catch {
      setError('Could not reach the server.');
    } finally {
      setSavingSub(null);
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (u.name || '').toLowerCase().includes(q)
      || (u.email || '').toLowerCase().includes(q);
  });

  const counts = ROLES.reduce((acc, r) => {
    acc[r] = users.filter(u => u.role === r).length;
    return acc;
  }, {});

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div>
          <h2>User Management</h2>
          <p>Assign roles to everyone who has signed in with Google.</p>
        </div>
        <Link to="/query" className="admin-query-link">Open Data Query &#8594;</Link>
      </div>

      <div className="role-legend">
        {ROLES.map(r => (
          <div className="role-legend-card" key={r}>
            <div className="role-legend-top">
              <span className={`role-pill role-${r}`}>{r}</span>
              <span className="role-legend-count">{counts[r] || 0}</span>
            </div>
            <p>{ROLE_BLURB[r]}</p>
          </div>
        ))}
      </div>

      {error && <div className="admin-error">{error}</div>}

      <input
        type="text"
        className="admin-search"
        placeholder="Search by name or email..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? (
        <p className="admin-empty">Loading users...</p>
      ) : filtered.length === 0 ? (
        <p className="admin-empty">
          {users.length === 0 ? 'Nobody has signed in yet.' : 'No users match that search.'}
        </p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Last login</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.sub}>
                  <td>
                    <div className="admin-user-cell">
                      {u.picture && (
                        <img src={u.picture} alt="" className="admin-avatar" referrerPolicy="no-referrer" />
                      )}
                      <span>{u.name || '—'}</span>
                      {u.sub === me.sub && <span className="admin-you">you</span>}
                    </div>
                  </td>
                  <td className="admin-email">{u.email}</td>
                  <td className="admin-date">{formatDate(u.created_at)}</td>
                  <td className="admin-date">{formatDate(u.last_login)}</td>
                  <td>
                    <select
                      className={`role-select role-select-${u.role}`}
                      value={u.role}
                      disabled={savingSub === u.sub}
                      onChange={e => changeRole(u.sub, e.target.value)}
                    >
                      {ROLES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Admin;
