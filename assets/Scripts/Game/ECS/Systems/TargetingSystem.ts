import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { MemoryComponent } from '../Components/MemoryComponent';
import { TargetComponent } from '../Components/TargetComponent';
import { TargetingComponent } from '../Components/TargetingComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { AggroComponent } from 'db://assets/Scripts/Game/ECS/Components/AggroComponent';
import { FactionType } from '../../Data/Faction';
import { TowerComponent } from '../Components/TowerComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { ProjectileComponent } from '../Components/ProjectileComponent';
import { ProjectileSpecComponent } from '../Components/ProjectileSpecComponent';
import { MeleeHitboxComponent } from '../Components/MeleeHitboxComponent';

export class TargetingSystem extends ECSSystem {
    private world: World;
    private timeSeconds: number = 0;

    constructor(world: World, priority: number = 6) {
        super('TargetingSystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, FactionComponent, MemoryComponent, TargetComponent, TargetingComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        this.timeSeconds += deltaTime;

        const assignedCountsByFaction = new Map<FactionType, Map<number, number>>();
        for (const entity of entities) {
            const faction = entity.getComponent(FactionComponent);
            const target = entity.getComponent(TargetComponent);
            if (!faction || !target) continue;
            const tid = target.targetEntityId;
            if (tid === null) continue;
            const m = this.getOrCreateCountMap(assignedCountsByFaction, faction.faction);
            m.set(tid, (m.get(tid) ?? 0) + 1);
        }

        for (const entity of entities) {
            const transform = entity.getComponent(TransformComponent);
            const faction = entity.getComponent(FactionComponent);
            const memory = entity.getComponent(MemoryComponent);
            const target = entity.getComponent(TargetComponent);
            const targeting = entity.getComponent(TargetingComponent);
            if (!transform || !faction || !memory || !target || !targeting) continue;

            targeting.timeSinceRetarget += deltaTime;

            const records = memory.records.filter(r => this.isAllowedTarget(faction.faction, r.entityId));

            const retargetJitter = 0.85 + this.rand01(entity.id, 101) * 0.3;
            const lockJitter = 0.85 + this.rand01(entity.id, 102) * 0.3;
            const effectiveRetargetInterval = targeting.retargetInterval * retargetJitter;
            const effectiveLockSeconds = targeting.lockSeconds * lockJitter;

            const counts = this.getOrCreateCountMap(assignedCountsByFaction, faction.faction);
            const currentId = target.targetEntityId;
            const currentExists = currentId !== null && !!this.world.getEntity(currentId);
            const stillKnown = currentId !== null && currentExists && records.some(r => r.entityId === currentId);

            if (currentId !== null && !currentExists) {
                counts.set(currentId, Math.max(0, (counts.get(currentId) ?? 1) - 1));
                target.targetEntityId = null;
                target.targetX = Number.NaN;
                target.targetY = Number.NaN;
                target.lockedUntilTime = 0;
            }

            const threatRadius = 40;
            const threatSq = threatRadius * threatRadius;

            const aggro = entity.getComponent(AggroComponent);
            const attackerId = aggro?.lastAttackerId ?? null;
            const hasAggro = attackerId !== null && (aggro?.aggroUntilTime ?? 0) > this.timeSeconds;
            if (hasAggro && attackerId !== currentId) {
                if (!this.isAllowedTarget(faction.faction, attackerId!)) {
                    // ignore
                } else {
                    const attackerRec = records.find(r => r.entityId === attackerId) ?? null;
                if (attackerRec) {
                    const adx = attackerRec.lastSeenX - transform.x;
                    const ady = attackerRec.lastSeenY - transform.y;
                    if (adx * adx + ady * ady <= threatSq) {
                        if (currentId !== null) counts.set(currentId, Math.max(0, (counts.get(currentId) ?? 1) - 1));
                        counts.set(attackerId!, (counts.get(attackerId!) ?? 0) + 1);
                        target.targetEntityId = attackerId;
                        target.targetX = attackerRec.lastSeenX;
                        target.targetY = attackerRec.lastSeenY;
                        target.lockedUntilTime = this.timeSeconds + effectiveLockSeconds;
                        targeting.timeSinceRetarget = 0;
                        continue;
                    }
                }
                }
            }

            if (currentId !== null && stillKnown) {
                const currentRec = records.find(r => r.entityId === currentId) ?? null;
                const cdx = (currentRec?.lastSeenX ?? transform.x) - transform.x;
                const cdy = (currentRec?.lastSeenY ?? transform.y) - transform.y;
                const currentDistSq = cdx * cdx + cdy * cdy;

                const nearest = this.chooseNearestRaw(transform.x, transform.y, records);
                const ndx = nearest.lastSeenX - transform.x;
                const ndy = nearest.lastSeenY - transform.y;
                const nearestDistSq = ndx * ndx + ndy * ndy;

                if (nearest.entityId !== currentId) {
                    const muchCloser = nearestDistSq < currentDistSq * 0.8;
                    const isMeleeClose = nearestDistSq <= threatSq;
                    if (muchCloser || isMeleeClose) {
                        counts.set(currentId, Math.max(0, (counts.get(currentId) ?? 1) - 1));
                        counts.set(nearest.entityId, (counts.get(nearest.entityId) ?? 0) + 1);
                        target.targetEntityId = nearest.entityId;
                        target.targetX = nearest.lastSeenX;
                        target.targetY = nearest.lastSeenY;
                        target.lockedUntilTime = this.timeSeconds + effectiveLockSeconds;
                        targeting.timeSinceRetarget = 0;
                        continue;
                    }
                }

                if (this.timeSeconds < target.lockedUntilTime) continue;
                target.lockedUntilTime = this.timeSeconds + effectiveLockSeconds;
                continue;
            }

            if (targeting.timeSinceRetarget < effectiveRetargetInterval) continue;
            targeting.timeSinceRetarget = 0;

            const prevId = target.targetEntityId;

            if (records.length === 0) {
                if (prevId !== null) counts.set(prevId, Math.max(0, (counts.get(prevId) ?? 1) - 1));
                target.targetEntityId = null;
                target.targetX = Number.NaN;
                target.targetY = Number.NaN;
                target.lockedUntilTime = 0;
                if (prevId !== null) {
                    console.log(`[TargetingSystem] ${entity.name} cleared target`);
                }
                continue;
            }

            const spreadWeight = 2500;
            const chosen =
                targeting.strategy === 'Nearest'
                    ? this.chooseNearestWithSpread(transform.x, transform.y, records, counts, spreadWeight)
                    : this.chooseMostRecent(records);

            if (prevId !== null) counts.set(prevId, Math.max(0, (counts.get(prevId) ?? 1) - 1));
            counts.set(chosen.entityId, (counts.get(chosen.entityId) ?? 0) + 1);

            target.targetEntityId = chosen.entityId;
            target.targetX = chosen.lastSeenX;
            target.targetY = chosen.lastSeenY;
            target.lockedUntilTime = this.timeSeconds + effectiveLockSeconds;

            if (prevId !== target.targetEntityId) {
                console.log(`[TargetingSystem] ${entity.name} target -> ${target.targetEntityId}`);
            }
        }
    }

    private rand01(a: number, b: number): number {
        let x = (a ^ b) >>> 0;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return (x >>> 0) / 4294967296;
    }

    private chooseMostRecent(records: { entityId: number; lastSeenX: number; lastSeenY: number; lastSeenTime: number }[]) {
        let best = records[0];
        for (let i = 1; i < records.length; i++) {
            if (records[i].lastSeenTime > best.lastSeenTime) best = records[i];
        }
        return best;
    }

    private chooseNearestRaw(
        x: number,
        y: number,
        records: { entityId: number; lastSeenX: number; lastSeenY: number; lastSeenTime: number }[]
    ) {
        let best = records[0];
        let bestDistSq = (best.lastSeenX - x) * (best.lastSeenX - x) + (best.lastSeenY - y) * (best.lastSeenY - y);
        for (let i = 1; i < records.length; i++) {
            const r = records[i];
            const dx = r.lastSeenX - x;
            const dy = r.lastSeenY - y;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDistSq) {
                best = r;
                bestDistSq = distSq;
            }
        }
        return best;
    }

    private chooseNearestWithSpread(
        x: number,
        y: number,
        records: { entityId: number; lastSeenX: number; lastSeenY: number; lastSeenTime: number }[],
        assignedCounts: Map<number, number>,
        spreadWeight: number
    ) {
        let best = records[0];
        let bestCost = Number.POSITIVE_INFINITY;

        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            const dx = r.lastSeenX - x;
            const dy = r.lastSeenY - y;
            const distSq = dx * dx + dy * dy;
            const n = assignedCounts.get(r.entityId) ?? 0;
            const cost = distSq + n * spreadWeight;
            if (cost < bestCost) {
                best = r;
                bestCost = cost;
            }
        }
        return best;
    }

    private getOrCreateCountMap(store: Map<FactionType, Map<number, number>>, faction: FactionType): Map<number, number> {
        const existing = store.get(faction);
        if (existing) return existing;
        const m = new Map<number, number>();
        store.set(faction, m);
        return m;
    }

    private isAllowedTarget(attackerFaction: FactionType, targetId: number): boolean {
        const ent = this.world.getEntity(targetId);
        if (!ent || !ent.active) return false;
        if (!ent.hasComponent(HealthComponent)) return false;
        const hp = ent.getComponent(HealthComponent);
        if (!hp || hp.isDead) return false;
        if (ent.hasComponent(ProjectileComponent) || ent.hasComponent(ProjectileSpecComponent) || ent.hasComponent(MeleeHitboxComponent)) return false;
        if (attackerFaction === FactionType.Enemy && ent.hasComponent(TowerComponent)) return false;
        return true;
    }
}
