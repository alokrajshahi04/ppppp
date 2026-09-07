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
            navigate('/dashboard');
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'login failed');
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="login-screen">
            <form className="login-card" onSubmit={onSubmit}>
                <div className="row" style={{ alignItems: 'center', marginBottom: 'var(--s-5)' }}>
                    <span style={{
                        display: 'inline-block', width: 14, height: 14,
                        background: 'var(--accent)', borderRadius: 2, marginRight: 8,
                    }} />
                    <strong style={{ letterSpacing: '0.04em' }}>TOLTI AI</strong>
                </div>
                <div className="login-title">Sign in</div>
                <div className="login-sub">Sovereign, on-premise, air-gapped workbench.</div>
                {err && <div className="banner banner-error">{err}</div>}
                <div className="field">
                    <label className="field-label">Email</label>
                    <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                <div className="field">
                    <label className="field-label">Password</label>
                    <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 8 }}>
                    {busy ? <span className="spinner" /> : 'Sign in'}
                </button>
                <div style={{ marginTop: 'var(--s-5)', fontSize: 'var(--fz-tiny)', color: 'var(--ink-3)' }}>
                    Seeded users: admin@tolti.ai · driver@tolti.ai · reviewer@tolti.ai · watcher@tolti.ai · security@tolti.ai
                    <br />Password for all: <span className="mono">admin</span>
                </div>
            </form>
        </div>
    );
}
