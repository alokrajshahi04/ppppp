// Tolti AI · presence + room types
import type { UUID, PresenceStatus, ISO8601 } from './common.js';

export interface PresenceEntry {
    user_id: UUID;
    display_name: string;
    role: string;
    status: PresenceStatus;
    last_seen: ISO8601;
}
