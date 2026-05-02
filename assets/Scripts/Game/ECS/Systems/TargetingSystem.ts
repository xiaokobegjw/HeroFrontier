import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { MemoryComponent } from '../Components/MemoryComponent';
import { TargetComponent } from '../Components/TargetComponent';
import { TargetingComponent } from '../Components/TargetingComponent';

export class TargetingSystem extends ECSSystem {
    private timeSeconds: number = 0;

    constructor(priority: number = 6) {
        super('TargetingSystem', priority);
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, MemoryComponent, TargetComponent, TargetingComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        this.timeSeconds += deltaTime;

        for (const entity of entities) {
            const transform = entity.getComponent(TransformComponent);
            const memory = entity.getComponent(MemoryComponent);
            const target = entity.getComponent(TargetComponent);
            const targeting = entity.getComponent(TargetingComponent);
            if (!transform || !memory || !target || !targeting) continue;

            targeting.timeSinceRetarget += deltaTime;

            const retargetJitter = 0.85 + this.rand01(entity.id, 101) * 0.3;
            const lockJitter = 0.85 + this.rand01(entity.id, 102) * 0.3;
            const effectiveRetargetInterval = targeting.retargetInterval * retargetJitter;
            const effectiveLockSeconds = targeting.lockSeconds * lockJitter;

            const currentId = target.targetEntityId;
            if (currentId !== null && this.timeSeconds < target.lockedUntilTime) {
                const stillKnown = memory.records.some(r => r.entityId === currentId);
                if (stillKnown) continue;
            }

            if (targeting.timeSinceRetarget < effectiveRetargetInterval) continue;
            targeting.timeSinceRetarget = 0;

            const prevId = target.targetEntityId;

            if (memory.records.length === 0) {
                target.targetEntityId = null;
                target.targetX = Number.NaN;
                target.targetY = Number.NaN;
                target.lockedUntilTime = 0;
                if (prevId !== null) {
                    console.log(`[TargetingSystem] ${entity.name} cleared target`);
                }
                continue;
            }

            const chosen =
                targeting.strategy === 'Nearest'
                    ? this.chooseNearest(transform.x, transform.y, memory.records)
                    : this.chooseMostRecent(memory.records);

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

    private chooseNearest(
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
}
