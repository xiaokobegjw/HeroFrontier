import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { MemoryComponent, MemoryRecord } from '../Components/MemoryComponent';
import { PerceptionComponent } from '../Components/PerceptionComponent';
import { SpatialIndexSystem } from './SpatialIndexSystem';

export class PerceptionSystem extends ECSSystem {
    private world: World;
    private timeSeconds: number = 0;

    constructor(world: World, priority: number = 5) {
        super('PerceptionSystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, FactionComponent, PerceptionComponent, MemoryComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        this.timeSeconds += deltaTime;
        const spatial = this.world.getSystem(SpatialIndexSystem);

        for (const entity of entities) {
            const transform = entity.getComponent(TransformComponent);
            const faction = entity.getComponent(FactionComponent);
            const perception = entity.getComponent(PerceptionComponent);
            const memory = entity.getComponent(MemoryComponent);
            if (!transform || !faction || !perception || !memory) continue;

            perception.timeSinceCheck += deltaTime;
            this.pruneExpired(memory, this.timeSeconds);

            if (perception.timeSinceCheck < perception.checkInterval) continue;
            perception.timeSinceCheck = 0;

            const viewRangeSq = perception.viewRange * perception.viewRange;

            const range = perception.viewRange;
            const rangeRect = { x: transform.x - range, y: transform.y - range, width: range * 2, height: range * 2 };
            const enemyFactions = faction.getEnemyFactions();
            const candidateIds = spatial ? spatial.queryFactions(enemyFactions, rangeRect) : [];

            const candidates = spatial
                ? candidateIds.map(id => this.world.getEntity(id))
                : this.world
                      .getAllEntities()
                      .filter(
                          e =>
                              e.active &&
                              e.hasComponent(TransformComponent) &&
                              e.hasComponent(FactionComponent) &&
                              enemyFactions.indexOf(e.getComponent(FactionComponent)!.faction) !== -1
                      );

            for (const other of candidates) {
                if (!other || other.id === entity.id || !other.active) continue;

                const otherFaction = other.getComponent(FactionComponent);
                if (!otherFaction) continue;
                if (otherFaction.faction === faction.faction) continue;

                const otherTransform = other.getComponent(TransformComponent);
                if (!otherTransform) continue;

                const dx = otherTransform.x - transform.x;
                const dy = otherTransform.y - transform.y;
                const distSq = dx * dx + dy * dy;
                if (distSq > viewRangeSq) continue;

                this.upsert(memory, {
                    entityId: other.id,
                    lastSeenX: otherTransform.x,
                    lastSeenY: otherTransform.y,
                    lastSeenTime: this.timeSeconds
                });
            }

            if (memory.records.length > memory.maxTargets) {
                memory.records.sort((a, b) => b.lastSeenTime - a.lastSeenTime);
                memory.records.length = memory.maxTargets;
            }
        }
    }

    private pruneExpired(memory: MemoryComponent, now: number): void {
        const ttl = memory.memorySeconds;
        if (ttl <= 0) {
            memory.records = [];
            return;
        }
        memory.records = memory.records.filter(r => now - r.lastSeenTime <= ttl);
    }

    private upsert(memory: MemoryComponent, record: MemoryRecord): void {
        const existing = memory.records.find(r => r.entityId === record.entityId);
        if (existing) {
            existing.lastSeenX = record.lastSeenX;
            existing.lastSeenY = record.lastSeenY;
            existing.lastSeenTime = record.lastSeenTime;
            return;
        }

        if (memory.records.length < memory.maxTargets) {
            memory.records.push(record);
            return;
        }

        let oldestIndex = 0;
        let oldestTime = memory.records[0]?.lastSeenTime ?? record.lastSeenTime;
        for (let i = 1; i < memory.records.length; i++) {
            const t = memory.records[i].lastSeenTime;
            if (t < oldestTime) {
                oldestTime = t;
                oldestIndex = i;
            }
        }
        memory.records[oldestIndex] = record;
    }
}
