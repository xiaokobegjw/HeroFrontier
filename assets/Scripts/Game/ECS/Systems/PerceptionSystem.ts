import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { MemoryComponent, MemoryRecord } from '../Components/MemoryComponent';
import { PerceptionComponent } from '../Components/PerceptionComponent';
import { SpatialIndexSystem } from './SpatialIndexSystem';
import { ObstacleComponent } from '../Components/ObstacleComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { SpatialHash, SpatialHashRect } from '../../../Shared/Spatial/SpatialHash';
import { TowerComponent } from '../Components/TowerComponent';

type ObstacleItem = {
    id: number;
    entity: Entity;
    transform: TransformComponent;
    collider: ColliderComponent;
    bounds: SpatialHashRect;
};

export class PerceptionSystem extends ECSSystem {
    private world: World;
    private timeSeconds: number = 0;
    private obstacleHash: SpatialHash<ObstacleItem>;
    private obstacleSignature: string = '';

    constructor(world: World, priority: number = 5) {
        super('PerceptionSystem', priority);
        this.world = world;
        this.obstacleHash = new SpatialHash<ObstacleItem>(64);
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, FactionComponent, PerceptionComponent, MemoryComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        this.timeSeconds += deltaTime;
        const spatial = this.world.getSystem(SpatialIndexSystem);

        // 刷新障碍物空间哈希（按需更新）
        this.refreshObstacleIndex();

        for (const entity of entities) {
            const transform = entity.getComponent(TransformComponent);
            const faction = entity.getComponent(FactionComponent);
            const perception = entity.getComponent(PerceptionComponent);
            const memory = entity.getComponent(MemoryComponent);
            if (!transform || !faction || !perception || !memory) continue;

            // 塔的视野不考虑障碍物遮挡，直接跳过视线检测
            const isTower = entity.hasComponent(TowerComponent);

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

                // 非塔单位需要进行视线检测
                if (!isTower && !this.hasLineOfSight(transform.x, transform.y, otherTransform.x, otherTransform.y)) {
                    continue;
                }

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

    private refreshObstacleIndex(): void {
        const obstacles = this.world
            .getAllEntities()
            .filter(e => e.active && e.hasComponent(ObstacleComponent) && e.hasComponent(TransformComponent) && e.hasComponent(ColliderComponent))
            .filter(e => e.getComponent(ObstacleComponent)!.blocksMovement);

        // 生成签名（包含所有障碍物的ID和位置）
        const signature = obstacles
            .map(e => {
                const tr = e.getComponent(TransformComponent)!;
                const col = e.getComponent(ColliderComponent)!;
                const b = this.getAABB(tr, col);
                return `${e.id}:${Math.floor(b.x)},${Math.floor(b.y)},${Math.floor(b.width)},${Math.floor(b.height)}`;
            })
            .sort()
            .join('|');

        // 如果签名没变，直接返回，不重建
        if (signature === this.obstacleSignature) return;

        // 否则重建空间哈希
        this.obstacleHash.clear();
        for (const entity of obstacles) {
            const tr = entity.getComponent(TransformComponent)!;
            const col = entity.getComponent(ColliderComponent)!;
            this.obstacleHash.insert({
                id: entity.id,
                entity,
                transform: tr,
                collider: col,
                bounds: this.getAABB(tr, col)
            });
        }
        this.obstacleSignature = signature;
    }

    private getAABB(transform: TransformComponent, collider: ColliderComponent): SpatialHashRect {
        const x = transform.x + collider.offsetX;
        const y = transform.y + collider.offsetY;

        if (collider.shape === ColliderShapeType.Circle) {
            const r = collider.radius;
            return { x: x - r, y: y - r, width: r * 2, height: r * 2 };
        }

        return { x: x - collider.width / 2, y: y - collider.height / 2, width: collider.width, height: collider.height };
    }

    private hasLineOfSight(startX: number, startY: number, endX: number, endY: number): boolean {
        // 使用空间哈希查询视线范围内的障碍物
        const queryRange: SpatialHashRect = {
            x: Math.min(startX, endX) - 32,
            y: Math.min(startY, endY) - 32,
            width: Math.abs(endX - startX) + 64,
            height: Math.abs(endY - startY) + 64
        };

        const candidates = this.obstacleHash.query(queryRange);
        for (const candidate of candidates) {
            const otr = candidate.transform;
            const ocol = candidate.collider;

            if (ocol.shape === ColliderShapeType.AABB) {
                const halfW = ocol.width * 0.5;
                const halfH = ocol.height * 0.5;
                const rx = otr.x + ocol.offsetX;
                const ry = otr.y + ocol.offsetY;

                if (this.lineIntersectsRect(startX, startY, endX, endY, rx - halfW, ry - halfH, rx + halfW, ry + halfH)) {
                    return false;
                }
            } else if (ocol.shape === ColliderShapeType.Circle) {
                const ox = otr.x + ocol.offsetX;
                const oy = otr.y + ocol.offsetY;
                const r = ocol.radius;

                if (this.lineIntersectsCircle(startX, startY, endX, endY, ox, oy, r)) {
                    return false;
                }
            }
        }

        return true;
    }

    private lineIntersectsRect(x1: number, y1: number, x2: number, y2: number, rx1: number, ry1: number, rx2: number, ry2: number): boolean {
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);

        if (maxX < rx1 || minX > rx2 || maxY < ry1 || minY > ry2) {
            return false;
        }

        const dx = x2 - x1;
        const dy = y2 - y1;

        const t0 = 0;
        const t1 = 1;

        let tNear = t0;
        let tFar = t1;

        if (dx !== 0) {
            const t1x = (rx1 - x1) / dx;
            const t2x = (rx2 - x1) / dx;
            tNear = Math.max(tNear, Math.min(t1x, t2x));
            tFar = Math.min(tFar, Math.max(t1x, t2x));
        }

        if (dy !== 0) {
            const t1y = (ry1 - y1) / dy;
            const t2y = (ry2 - y1) / dy;
            tNear = Math.max(tNear, Math.min(t1y, t2y));
            tFar = Math.min(tFar, Math.max(t1y, t2y));
        }

        return tNear <= tFar;
    }

    private lineIntersectsCircle(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number): boolean {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;

        if (lenSq === 0) {
            const distSq = (x1 - cx) * (x1 - cx) + (y1 - cy) * (y1 - cy);
            return distSq <= r * r;
        }

        const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lenSq));
        const nearX = x1 + t * dx;
        const nearY = y1 + t * dy;
        const distSq = (nearX - cx) * (nearX - cx) + (nearY - cy) * (nearY - cy);

        return distSq <= r * r;
    }
}
