import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';

export function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState('admin@tolti.ai');
    const [password, setPassword] = useState('admin');
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
            await login(email, password);
            navigate('/', { replace: true });
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Sign in failed. Check your credentials.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="login-screen">
            <form className="login-card" onSubmit={onSubmit}>
                <div className="row" style={{ gap: 10, marginBottom: 'var(--s-6)' }}>
                    <span className="logo" style={{
                        width: 24, height: 24, borderRadius: 6, background: 'var(--accent)',
                        color: '#0B0B0B', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14,
                    }}>t</span>
                    <strong style={{ letterSpacing: '0.06em', fontSize: 'var(--fz-h3)' }}>TOLTI AI</strong>
                </div>
                <div className="login-title">Sign in</div>
                <div className="login-sub">Sovereign, on-premise, air-gapped workspace. No data leaves this network.</div>
                {err && <div className="banner banner-error">{err}</div>}
                <div className="field">
                    <label className="field-label">Email</label>
                    <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                <div className="field">
                    <label className="field-label">Password</label>
                    <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button className="btn btn-accent" type="submit" disabled={busy} style={{ width: '100%', marginTop: 6, minHeight: 38 }}>
                    {busy ? <span className="spinner" /> : 'Sign in'}
                </button>
                <div style={{ marginTop: 'var(--s-5)', fontSize: 'var(--fz-tiny)', color: 'var(--ink-3)', lineHeight: 1.6 }}>
                    Seeded users: admin · driver · reviewer · watcher · security @tolti.ai<br />
                    Password for all: <span className="mono">admin</span> — change before any real deployment.
                </div>
            </form>
        </div>
    );
}
