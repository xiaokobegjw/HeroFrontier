export type KillEvent = {
    killerId: number | null;
    victimId: number;
    victimFaction: number;
    gold: number;
};

const killEvents: KillEvent[] = [];

export function emitKillEvent(ev: KillEvent): void {
    killEvents.push(ev);
}

export function drainKillEvents(): KillEvent[] {
    if (killEvents.length === 0) return [];
    const out = killEvents.slice();
    killEvents.length = 0;
    return out;
}
