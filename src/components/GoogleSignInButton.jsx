import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

// renders google's sign-in button and hands the credential to the auth context
function GoogleSignInButton({ size = 'medium' }) {
  const buttonRef = useRef(null);
  const { login } = useAuth();

  useEffect(() => {
    // google's script loads async, so poll until it and the div both exist
    const interval = setInterval(() => {
      if (!window.google || !buttonRef.current) return;
      clearInterval(interval);

      window.google.accounts.id.initialize({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        callback: (response) => {
          login(response.credential).catch(err =>
            console.error('Login failed:', err)
          );
        },
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size,
      });
    }, 100);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={buttonRef}></div>;
}

export default GoogleSignInButton;
