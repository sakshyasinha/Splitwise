import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import Input from '../ui/Input.jsx';
import useAuth from '../../hooks/useAuth.js';
import { getGoogleAuthConfig } from '../../services/auth.service.js';

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register, loginWithGoogle, loading, error, clearError } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [googleAuth, setGoogleAuth] = useState({ loading: true, enabled: false, clientId: null, error: null });
  const googleButtonRef = useRef(null);

  const handleChange = (event) => {
    clearError();
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      if (mode === 'register') {
        await register(form);
      }
      await login(form.email, form.password);
      navigate('/');
    } catch (_error) {
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function setupGoogleAuth() {
      try {
        const config = await getGoogleAuthConfig();
        if (cancelled) return;

        if (!config?.enabled || !config?.clientId) {
          setGoogleAuth({ loading: false, enabled: false, clientId: null, error: null });
          return;
        }

        await loadGoogleScript();
        if (cancelled || !googleButtonRef.current) return;

        window.google.accounts.id.initialize({
          client_id: config.clientId,
          callback: async (response) => {
            try {
              clearError();
              await loginWithGoogle(response.credential);
              navigate('/');
            } catch (_error) {
              // Error is handled in store state.
            }
          },
        });

        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: mode === 'login' ? 'signin_with' : 'signup_with',
          width: 360,
        });
        setGoogleAuth({ loading: false, enabled: true, clientId: config.clientId, error: null });
      } catch (_error) {
        if (!cancelled) {
          setGoogleAuth({
            loading: false,
            enabled: false,
            clientId: null,
            error: 'Google sign-in is unavailable while the backend is offline.'
          });
        }
      }
    }

    setupGoogleAuth();

    return () => {
      cancelled = true;
    };
  }, [clearError, loginWithGoogle, mode, navigate]);

  return (
    <main className="auth-layout">
      <section className="auth-hero">
        <div className="auth-hero-badge">Shared money, handled cleanly</div>
        <h1>Split expenses without the clutter.</h1>
        <p>
          Keep every payment, balance, and settlement in one polished workspace so the group
          always sees the same truth.
        </p>
        <div className="auth-points">
          <div className="auth-point">
            <strong>Live balances</strong>
            <span>Track who owes what the moment an expense is added.</span>
          </div>
          <div className="auth-point">
            <strong>Fast settle-ups</strong>
            <span>See the cleanest path to zero without mental bookkeeping.</span>
          </div>
          <div className="auth-point">
            <strong>Built for groups</strong>
            <span>From trips to rent, keep shared spending visible and organized.</span>
          </div>
        </div>
      </section>

      <Card
        className="auth-card"
        title={mode === 'login' ? 'Welcome Back' : 'Create Account'}
        subtitle="Your shared money command center"
      >
        <form className="stack" onSubmit={handleSubmit}>
          <div className="google-auth-slot" hidden={!googleAuth.enabled && !googleAuth.loading && !googleAuth.error}>
            {googleAuth.loading && <div className="google-auth-placeholder">Loading Google sign-in...</div>}
            {googleAuth.error && <div className="google-auth-placeholder">{googleAuth.error}</div>}
            <div ref={googleButtonRef} className="google-auth-button" />
          </div>

          {googleAuth.enabled && <div className="auth-divider"><span>or</span></div>}

          {mode === 'register' && (
            <Input
              id="name"
              name="name"
              label="Full Name"
              placeholder="Alex Johnson"
              value={form.name}
              onChange={handleChange}
              required
            />
          )}

          <Input
            id="email"
            name="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            value={form.email}
            onChange={handleChange}
            required
          />

          <Input
            id="password"
            name="password"
            type="password"
            label="Password"
            placeholder="At least 6 characters"
            value={form.password}
            onChange={handleChange}
            required
            minLength={6}
          />

          {error && <p className="banner error">{error}</p>}

          <Button type="submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              clearError();
              setMode((prev) => (prev === 'login' ? 'register' : 'login'));
            }}
          >
            {mode === 'login' ? 'Need an account? Register' : 'Already have an account? Login'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
