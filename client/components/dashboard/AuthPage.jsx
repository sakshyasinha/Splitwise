import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button.jsx';
import Card from '../ui/Card.jsx';
import Input from '../ui/Input.jsx';
import useAuth from '../../hooks/useAuth.js';

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register, loading, error, clearError } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });

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
      // Error is handled in store state.
    }
  };

  return (
    <main className="auth-layout">
      <Card
        className="auth-card"
        title={mode === 'login' ? 'Welcome Back' : 'Create Account'}
        subtitle="Your shared money command center"
      >
        <form className="stack" onSubmit={handleSubmit}>
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