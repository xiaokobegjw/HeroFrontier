export type KillEvent = {
    killerId: number | null;
    victimId: number;
    victimFaction: number;
    gold: number;
    x: number;
    y: number;
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

export type ProjectileExplodeEvent = {
    ownerId: number | null;
    ownerFaction: number;
    x: number;
    y: number;
    splashRadius: number;
    damage: number;
    armorPenPct: number;
    skillMultiplier: number;
    critChance: number;
    critMultiplier: number;
    finalDamageBonusPct: number;
    damageType: 'Physical' | 'Magic';
    splashDamageCooldown: number;
};

export type ExplosionEffectEvent = {
    prefabPath: string;
    x: number;
    y: number;
};

export type HeroUpgradeEffectEvent = {
    prefabPath: string;
    x: number;
    y: number;
};

export type HeroSpellEffectEvent = {
    prefabPath: string;
    x: number;
    y: number;
};

export type HitFlashEvent = {
    entityId: number;
    x: number;
    y: number;
};

export type DropCoinEffectEvent = {
    x: number;
    y: number;
    gold: number;
};

const killEvents: KillEvent[] = [];
const expEvents: ExpEvent[] = [];
const deathViewEvents: DeathViewEvent[] = [];
const projectileExplodeEvents: ProjectileExplodeEvent[] = [];
const explosionEffectEvents: ExplosionEffectEvent[] = [];
const heroUpgradeEffectEvents: HeroUpgradeEffectEvent[] = [];
const heroSpellEffectEvents: HeroSpellEffectEvent[] = [];
const hitFlashEvents: HitFlashEvent[] = [];
const dropCoinEffectEvents: DropCoinEffectEvent[] = [];

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

export function emitProjectileExplodeEvent(ev: ProjectileExplodeEvent): void {
    projectileExplodeEvents.push(ev);
}

export function drainProjectileExplodeEvents(): ProjectileExplodeEvent[] {
    if (projectileExplodeEvents.length === 0) return [];
    const out = projectileExplodeEvents.slice();
    projectileExplodeEvents.length = 0;
    return out;
}

export function emitExplosionEffectEvent(ev: ExplosionEffectEvent): void {
    explosionEffectEvents.push(ev);
}

export function drainExplosionEffectEvents(): ExplosionEffectEvent[] {
    if (explosionEffectEvents.length === 0) return [];
    const out = explosionEffectEvents.slice();
    explosionEffectEvents.length = 0;
    return out;
}

export function emitHeroUpgradeEffectEvent(ev: HeroUpgradeEffectEvent): void {
    heroUpgradeEffectEvents.push(ev);
}

export function drainHeroUpgradeEffectEvents(): HeroUpgradeEffectEvent[] {
    if (heroUpgradeEffectEvents.length === 0) return [];
    const out = heroUpgradeEffectEvents.slice();
    heroUpgradeEffectEvents.length = 0;
    return out;
}

export function emitHeroSpellEffectEvent(ev: HeroSpellEffectEvent): void {
    heroSpellEffectEvents.push(ev);
}

export function drainHeroSpellEffectEvents(): HeroSpellEffectEvent[] {
    if (heroSpellEffectEvents.length === 0) return [];
    const out = heroSpellEffectEvents.slice();
    heroSpellEffectEvents.length = 0;
    return out;
}

export function emitHitFlashEvent(ev: HitFlashEvent): void {
    hitFlashEvents.push(ev);
}

export function drainHitFlashEvents(): HitFlashEvent[] {
    if (hitFlashEvents.length === 0) return [];
    const out = hitFlashEvents.slice();
    hitFlashEvents.length = 0;
    return out;
}

export function emitDropCoinEffectEvent(ev: DropCoinEffectEvent): void {
    dropCoinEffectEvents.push(ev);
}

export function drainDropCoinEffectEvents(): DropCoinEffectEvent[] {
    if (dropCoinEffectEvents.length === 0) return [];
    const out = dropCoinEffectEvents.slice();
    dropCoinEffectEvents.length = 0;
    return out;
}
