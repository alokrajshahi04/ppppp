import type { SysStatus } from './Shell';
import { IconAlert, IconCheck } from '../ui/icons';

export function DiagnosticsPop({ sys, isAdmin, onClose }: { sys: SysStatus; isAdmin: boolean; onClose: () => void }) {
    const h = sys.health;
    const svc = (label: string, ok: boolean | undefined) => (
        <div className="pop-row">
            <span className="pr-main">{label}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: ok ? 'var(--live)' : 'var(--danger)', fontSize: 'var(--fz-tiny)' }}>
                {ok ? <IconCheck size={12} /> : <IconAlert size={12} />} {ok ? 'ok' : 'down'}
            </span>
        </div>
    );

    return (
        <div className="pop" style={{ minWidth: 340 }}>
            <div className="row-between" style={{ marginBottom: 4 }}>
                <div className="pop-title" style={{ padding: 0 }}>Diagnostics</div>
                <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: '2px 6px' }}>Esc</button>
            </div>
            {h && typeof h === 'object' && h.services ? (
                <>
                    {svc('Database', h.services.database === 'ok')}
                    {svc('Object store', h.services.object_store === 'ok')}
                    {svc('AI engine', h.services.ai_engine === 'ok')}
                    <div className="muted mono" style={{ padding: '4px 8px 0', fontSize: 10.5 }}>
                        v{h.version} · uptime {Math.floor(h.uptime_seconds / 60)}m · status {h.status}
                    </div>
                </>
            ) : (
                <div className="muted" style={{ padding: '4px 8px', fontSize: 'var(--fz-small)' }}>Backend unreachable.</div>
            )}
            <div className="pop-sep" />
            <div className="pop-title">Model endpoints</div>
            {sys.models.length === 0 ? (
                <div className="muted" style={{ padding: '0 8px', fontSize: 'var(--fz-small)' }}>None configured.</div>
            ) : (
                sys.models.map((m) => (
                    <div className="pop-row" key={m.id}>
                        <span>
                            <span className="pr-main" style={{ display: 'block' }}>{m.capability} · {m.model_id}</span>
                            <span className="pr-sub mono">{m.base_url}</span>
                        </span>
                        {m.is_default && <span className="pill pill-accent">default</span>}
                    </div>
                ))
            )}
            {!isAdmin && (
                <div className="muted" style={{ padding: '8px 8px 0', fontSize: 'var(--fz-tiny)' }}>
                    Model configuration is managed by an administrator.
                </div>
            )}
        </div>
    );
}
