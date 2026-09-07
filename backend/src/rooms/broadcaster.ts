import { nanoid } from 'nanoid';

// In-process broadcaster. Single-node dev only — for production swap with redis-pubsub.
type Listener = (env: any) => void;

const rooms = new Map<string, Set<Listener>>();

function room(taskId: string): Set<Listener> {
    let set = rooms.get(taskId);
    if (!set) {
        set = new Set();
        rooms.set(taskId, set);
    }
    return set;
}

export function broadcastTaskEvent(taskId: string, envelope: any): void {
    const set = rooms.get(taskId);
    if (!set || set.size === 0) return;
    for (const listener of set) {
        try {
            listener({ ...envelope, ts: new Date().toISOString(), _id: nanoid(8) });
        } catch (e) {
            // listener threw — drop it
            set.delete(listener);
        }
    }
}

export function registerRoomListener(taskId: string, listener: Listener): () => void {
    const set = room(taskId);
    set.add(listener);
    return () => set.delete(listener);
}

// Used at server shutdown to clear state.
export function clearRooms(): void {
    rooms.clear();
}
