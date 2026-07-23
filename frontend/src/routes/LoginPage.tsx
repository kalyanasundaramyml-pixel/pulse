import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ApiError } from '../api/client';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page auth-page-split">
      <div className="auth-hero">
        <span className="auth-logo auth-hero-logo">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M 10 50 L 30 50 L 35 40 L 42 60 L 50 15 L 58 85 L 65 40 L 70 50 L 90 50"
              stroke="#A0522D"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h1>Pulse</h1>
        <p className="auth-hero-tagline">Collect constructive feedback anonymously. Simplify 1:1s.</p>
        <ul className="auth-hero-features">
          <li>Anonymous or named surveys, your call </li>
          <li>Recurring 1:1s with trend tracking over time</li>
          <li>Results creators can actually act on</li>
        </ul>
      </div>
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Sign in</h1>
        <p>Use the account your admin set up for you.</p>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
