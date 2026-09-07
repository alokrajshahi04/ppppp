import { useEffect, useState, type FormEvent } from 'react';
import type { ModelConfig, ModelCapability, RoutingPolicy } from '@tolti/contracts';
import { api } from '../api/client';

export function ModelsAdminPage() {
    const [models, setModels] = useState<ModelConfig[]>([]);
    const [policies, setPolicies] = useState<RoutingPolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const [m, setM] = useState({ capability: 'TEXT' as ModelCapability, name: '', provider: 'openai-compatible', base_url: 'http://host.docker.internal:11434/v1', model_id: '', is_default: true, api_key: '' });

    async function refresh() {
        setLoading(true);
        try {
            const [mm, pp] = await Promise.all([
                api.get<ModelConfig[]>('/api/v1/models'),
                api.get<RoutingPolicy[]>('/api/v1/routing-policies'),
            ]);
            setModels(mm);
            setPolicies(pp);
        } finally { setLoading(false); }
    }
    useEffect(() => { void refresh(); }, []);

    async function createModel(e: FormEvent) {
        e.preventDefault();
        await api.post<ModelConfig>('/api/v1/models', m);
        await refresh();
    }

    async function activatePolicy(id: string) {
        await api.post<RoutingPolicy>(`/api/v1/routing-policies/${id}/activate`);
        await refresh();
    }

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <div className="page-title">AI configuration</div>
                    <div className="page-sub">Model endpoints and Agent Router policy. All endpoints are OpenAI-compatible.</div>
                </div>
            </div>

            <div className="card">
                <div className="card-title">Model endpoints</div>
                {loading ? <div className="empty"><span className="spinner" /></div> : (
                    <div className="table-wrap">
                    <table className="table">
                        <thead>
                            <tr><th>Capability</th><th>Name</th><th>Model</th><th>Endpoint</th><th>Default</th><th></th></tr>
                        </thead>
                        <tbody>
                            {models.map((mc) => (
                                <tr key={mc.id}>
                                    <td><span className="pill pill-accent">{mc.capability}</span></td>
                                    <td>{mc.name}</td>
                                    <td className="mono">{mc.model_id}</td>
                                    <td className="mono muted">{mc.base_url}</td>
                                    <td>{mc.is_default ? <span className="pill pill-success">default</span> : <span className="muted">—</span>}</td>
                                    <td><button className="btn btn-sm btn-ghost" onClick={async () => {
                                        await api.del(`/api/v1/models/${mc.id}`);
                                        await refresh();
                                    }}>Remove</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                )}
            </div>

            <form className="card" style={{ marginTop: 'var(--s-4)' }} onSubmit={createModel}>
                <div className="card-title">Add a model endpoint</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--s-3)' }}>
                    <div className="field">
                        <label className="field-label">Capability</label>
                        <select className="select" value={m.capability} onChange={(e) => setM({ ...m, capability: e.target.value as ModelCapability })}>
                            {(['OCR', 'VISION', 'TEXT', 'CODE', 'EMBEDDING'] as ModelCapability[]).map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                    <div className="field">
                        <label className="field-label">Name</label>
                        <input className="input" value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} required />
                    </div>
                    <div className="field">
                        <label className="field-label">Model id</label>
                        <input className="input" value={m.model_id} onChange={(e) => setM({ ...m, model_id: e.target.value })} required />
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 'var(--s-3)' }}>
                    <div className="field">
                        <label className="field-label">Base URL</label>
                        <input className="input" value={m.base_url} onChange={(e) => setM({ ...m, base_url: e.target.value })} required />
                    </div>
                    <div className="field">
                        <label className="field-label">API key</label>
                        <input className="input" value={m.api_key} onChange={(e) => setM({ ...m, api_key: e.target.value })} />
                    </div>
                    <div className="field" style={{ alignSelf: 'end' }}>
                        <label className="row" style={{ gap: 6 }}>
                            <input type="checkbox" checked={m.is_default} onChange={(e) => setM({ ...m, is_default: e.target.checked })} />
                            <span className="muted">Default</span>
                        </label>
                    </div>
                </div>
                <button className="btn btn-primary" type="submit">Add model</button>
            </form>

            <div className="card" style={{ marginTop: 'var(--s-4)' }}>
                <div className="card-title">Routing policies</div>
                {policies.length === 0 ? <div className="muted">No policies.</div> : (
                    <div className="table-wrap">
                    <table className="table">
                        <thead>
                            <tr><th>Name</th><th>Status</th><th>Rules</th><th></th></tr>
                        </thead>
                        <tbody>
                            {policies.map((p) => (
                                <tr key={p.id}>
                                    <td>{p.name}</td>
                                    <td>{p.is_active ? <span className="pill pill-success">active</span> : <span className="muted">—</span>}</td>
                                    <td className="muted mono">{p.rules.length} rules</td>
                                    <td>{!p.is_active && <button className="btn btn-sm btn-ghost" onClick={() => activatePolicy(p.id)}>Activate</button>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                )}
            </div>
        </div>
    );
}
