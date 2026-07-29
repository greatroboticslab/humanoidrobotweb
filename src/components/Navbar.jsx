import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleSignInButton from './GoogleSignInButton';
import './Navbar.css';

function Navbar() {
  const location = useLocation();
  const { user, loading, logout } = useAuth();

  return (
    <nav className="navbar">
      <Link to="/" className="nav-logo">
        <span>Humanoid <strong>Farming</strong></span>
      </Link>
      <ul className="nav-links">
        <li><Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link></li>
        <li><Link to="/dataset" className={location.pathname === '/dataset' ? 'active' : ''}>Dataset</Link></li>
        <li><Link to="/tools" className={location.pathname === '/tools' ? 'active' : ''}>Tools</Link></li>
        <li><Link to="/about" className={location.pathname === '/about' ? 'active' : ''}>About</Link></li>
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
    </nav>
  );
}

export default Navbar;
