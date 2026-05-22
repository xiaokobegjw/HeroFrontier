export type KillEvent = {
    killerId: number | null;
    victimId: number;
    victimFaction: number;
    gold: number;
};

export type ExpEvent = {
    killerId: number | null;
    victimId: number;
    victimFaction: number;
    exp: number;
};

export type DeathViewEvent = {
    prefabPath: string;
    dieClipPath: string;
    dieStateName: string;
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
};

const killEvents: KillEvent[] = [];
const expEvents: ExpEvent[] = [];
const deathViewEvents: DeathViewEvent[] = [];

export function emitKillEvent(ev: KillEvent): void {
    killEvents.push(ev);
}

export function drainKillEvents(): KillEvent[] {
    if (killEvents.length === 0) return [];
    const out = killEvents.slice();
    killEvents.length = 0;
    return out;
}

export function emitExpEvent(ev: ExpEvent): void {
    expEvents.push(ev);
}

export function drainExpEvents(): ExpEvent[] {
    if (expEvents.length === 0) return [];
    const out = expEvents.slice();
    expEvents.length = 0;
    return out;
}

export function emitDeathViewEvent(ev: DeathViewEvent): void {
    deathViewEvents.push(ev);
}

export function drainDeathViewEvents(): DeathViewEvent[] {
    if (deathViewEvents.length === 0) return [];
    const out = deathViewEvents.slice();
    deathViewEvents.length = 0;
    return out;
}
