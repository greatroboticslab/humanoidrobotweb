import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleSignInButton from './GoogleSignInButton';
import './Navbar.css';

function Navbar() {
  const location = useLocation();
  const { user, loading, logout, isAdmin, isDeveloper } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // collapse the mobile menu whenever user lands on a new page
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className="navbar">
      <Link to="/" className="nav-logo">
        <span>Humanoid <strong>Farming</strong></span>
      </Link>

      <button
        className={`nav-toggle ${menuOpen ? 'open' : ''}`}
        onClick={() => setMenuOpen(open => !open)}
        aria-expanded={menuOpen}
        aria-controls="nav-collapse"
        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
      >
        <span /><span /><span />
      </button>

      <div className={`nav-collapse ${menuOpen ? 'open' : ''}`} id="nav-collapse">
        <ul className="nav-links">
          <li><Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link></li>
          <li><Link to="/dataset" className={location.pathname === '/dataset' ? 'active' : ''}>Dataset</Link></li>
          <li><Link to="/tools" className={location.pathname === '/tools' ? 'active' : ''}>Tools</Link></li>
          <li><Link to="/about" className={location.pathname === '/about' ? 'active' : ''}>About</Link></li>

          {/* internal tools, only shown to the roles that can open them */}
          {isDeveloper && (
            <li>
              <Link to="/query" className={location.pathname === '/query' ? 'active' : ''}>
                Query <span className="nav-badge">internal</span>
              </Link>
            </li>
          )}
          {isAdmin && (
            <li>
              <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>
                Admin <span className="nav-badge">internal</span>
              </Link>
            </li>
          )}
        </ul>

        {/* auth area, sign-in button or the current user */}
        <div className="nav-auth">
          {loading ? null : user ? (
            <div className="nav-user">
              {user.picture && (
                <img src={user.picture} alt="" className="nav-avatar" referrerPolicy="no-referrer" />
              )}
              <div className="nav-user-text">
                <span className="nav-username">{user.name}</span>
                {user.role !== 'user' && <span className="nav-role">{user.role}</span>}
              </div>
              <button className="nav-logout" onClick={logout}>Log out</button>
            </div>
          ) : (
            <GoogleSignInButton size="medium" />
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
