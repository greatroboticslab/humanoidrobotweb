import { useAuth } from '../context/AuthContext';
import GoogleSignInButton from './GoogleSignInButton';
import './RequireRole.css';

// wraps a route so only the listed roles can see it. anyone signed out gets a
// sign-in prompt, anyone signed in with the wrong role gets told why.
function RequireRole({ roles, children }) {
  const { user, loading, hasRole } = useAuth();

  if (loading) return <div className="loading">Loading...</div>;

  if (!user) {
    return (
      <div className="role-gate">
        <h2>Sign in required</h2>
        <p>This page is only available to signed-in team members.</p>
        <GoogleSignInButton size="large" />
      </div>
    );
  }

  if (!hasRole(...roles)) {
    return (
      <div className="role-gate">
        <h2>Not available for your account</h2>
        <p>
          This page needs the {roles.join(' or ')} role. You're signed in as{' '}
          <strong>{user.name}</strong> with the <strong>{user.role}</strong> role.
        </p>
        <p className="role-gate-hint">Ask an admin if you think you should have access.</p>
      </div>
    );
  }

  return children;
}

export default RequireRole;
