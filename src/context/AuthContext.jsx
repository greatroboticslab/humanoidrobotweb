import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // re-read the session from the server; also used after a 401 to clear
  // a user whose session expired while the tab was open
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      setUser(data.user || null);
      return data.user || null;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  // check for an existing session cookie on mount
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // exchange a google credential for a flask session
  const login = async (credential) => {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    });
    if (!res.ok) throw new Error('Login failed');
    const loggedIn = await res.json();
    setUser(loggedIn);
    return loggedIn;
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  const role = user?.role || null;
  const isAdmin = role === 'admin';
  // admins can do anything a developer can, so treat them as a superset
  const isDeveloper = role === 'developer' || isAdmin;
  const hasRole = (...roles) => !!role && roles.includes(role);

  return (
    <AuthContext.Provider
      value={{ user, role, loading, login, logout, isAdmin, isDeveloper, hasRole, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
