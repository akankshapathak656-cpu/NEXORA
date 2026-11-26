import { useEffect, useState } from 'react';
import { Plate } from '../../components/ui/Plate.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { getState, setState } from '../../store/state.js';
import { go } from '../../routes.js';

// Legacy: login() (app.js line 153) and doLogin() (line 154). Demo sign-in only: no real authentication.
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export default function Login() {
  const toast = useToast();
  const [email, setEmail] = useState('recruiter@demo.nexora');

  useEffect(() => {
    document.title = 'NEXORA | Sign in';
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) {
      toast('Enter a valid email');
      return;
    }
    const next = getState().next;
    setState({ auth: 1, next: '' });
    go(next || 'dashboard');
  };

  return (
    <div className="lg">
      <main className="card" id="m" tabIndex={-1} style={{ width: 420, maxWidth: '100%', padding: 30 }}>
        <div style={{ textAlign: 'center' }}>
          <Plate height={110} />
          <h2 style={{ marginTop: 14 }}>Sign in to your workspace</h2>
        </div>
        <form onSubmit={onSubmit}>
          <p><label htmlFor="em">Email</label></p>
          <input
            id="em"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%' }}
            autoComplete="username"
          />
          <p><label htmlFor="pw">Password</label></p>
          <input
            id="pw"
            type="password"
            required
            minLength={6}
            defaultValue="demo1234"
            style={{ width: '100%' }}
            autoComplete="current-password"
          />
          <p style={{ fontSize: 12 }}>Demo login: no real authentication is performed.</p>
          <button className="btn p" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>Sign in</button>
        </form>
        <p style={{ textAlign: 'center' }}>
          <a href="/" style={{ color: 'var(--c)' }}>Back to home</a> · <a href="/terms" style={{ color: 'var(--c)' }}>Terms</a> · <a href="/privacy" style={{ color: 'var(--c)' }}>Privacy</a>
        </p>
      </main>
    </div>
  );
}
