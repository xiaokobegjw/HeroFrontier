import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { MoveStatsComponent } from '../Components/MoveStatsComponent';
import { ObstacleComponent } from '../Components/ObstacleComponent';
import { SpatialHash, SpatialHashRect } from '../../../Shared/Spatial/SpatialHash';
import { GameConfigManager } from '../../../Shared/Managers/GameConfigManager';
import { DebugState } from '../../../Game/Debug/DebugState';

type ObstacleItem = {
    id: number;
    entity: Entity;
    transform: TransformComponent;
    collider: ColliderComponent;
    bounds: SpatialHashRect;
};

export class MovementBlockSystem extends ECSSystem {
    private world: World;
    private spatialHash: SpatialHash<ObstacleItem>;
    private obstacleSignature: string = '';

    constructor(world: World, priority: number = 4.85) {
        super('MovementBlockSystem', priority);
        this.world = world;
        this.spatialHash = new SpatialHash<ObstacleItem>(64);
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, ColliderComponent, MoveStatsComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        const obstacles = this.world
            .getAllEntities()
            .filter(e => e.active && e.hasComponent(ObstacleComponent) && e.hasComponent(TransformComponent) && e.hasComponent(ColliderComponent))
            .filter(e => e.getComponent(ObstacleComponent)!.blocksMovement);

        if (obstacles.length === 0) return;

        this.refreshObstacleIndex(obstacles);

        for (const entity of entities) {
            if (!entity.active) continue;
            if (entity.hasComponent(ObstacleComponent)) continue;
            const tr = entity.getComponent(TransformComponent);
            const col = entity.getComponent(ColliderComponent);
            const moveStats = entity.getComponent(MoveStatsComponent);
            if (!tr || !col || !moveStats) continue;
            if (col.shape !== ColliderShapeType.Circle) continue;

            const currX = tr.x;
            const currY = tr.y;
            const prevX = moveStats.prevX;
            const prevY = moveStats.prevY;

            if (!moveStats.prevPosInitialized) {
                moveStats.prevX = currX;
                moveStats.prevY = currY;
                moveStats.prevPosInitialized = true;
            } else {
                const dx = currX - prevX;
                const dy = currY - prevY;
                const moveDist = Math.sqrt(dx * dx + dy * dy);

                if (moveDist > 1e-6) {

                     if (GameConfigManager.instance.isPC && GameConfigManager.instance.isDebug)
                    {
                        if(entity.id === DebugState.selectedEntityId)
                        {
                            let adfasd = 0;
                            adfasd++;
                        }
                    }

                    const hasObstacleOnPath = this.rayCheckObstacles(prevX, prevY, dx, dy, col.radius);
                    if (hasObstacleOnPath) {
                        tr.x = prevX;
                        tr.y = prevY;
                    }
                }
            }

            for (let iter = 0; iter < 4; iter++) {
                const queryRange = this.getAABB(tr, col);
                const candidates = this.spatialHash.query(queryRange);
                if (candidates.length === 0) break;

                let moved = false;
                for (const candidate of candidates) {
                    moved = this.resolveAgainstObstacle(entity, candidate.entity) || moved;
                }
                if (!moved) break;
            }

            moveStats.prevX = tr.x;
            moveStats.prevY = tr.y;
        }
    }

    private refreshObstacleIndex(obstacles: Entity[]): void {
        const signature = obstacles
            .map(e => {
                const tr = e.getComponent(TransformComponent)!;
                const col = e.getComponent(ColliderComponent)!;
                const b = this.getAABB(tr, col);
                return `${e.id}:${b.x.toFixed(1)},${b.y.toFixed(1)},${b.width.toFixed(1)},${b.height.toFixed(1)}`;
            })
            .sort()
            .join('|');

        if (signature === this.obstacleSignature) return;

        this.spatialHash.clear();
        for (const entity of obstacles) {
            const tr = entity.getComponent(TransformComponent)!;
            const col = entity.getComponent(ColliderComponent)!;
            this.spatialHash.insert({
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

    private resolveAgainstObstacle(entity: Entity, obstacle: Entity): boolean {
        const tr = entity.getComponent(TransformComponent);
        const col = entity.getComponent(ColliderComponent);
        const otr = obstacle.getComponent(TransformComponent);
        const ocol = obstacle.getComponent(ColliderComponent);
        if (!tr || !col || !otr || !ocol) return false;

        const cx = tr.x + col.offsetX;
        const cy = tr.y + col.offsetY;
        const r = col.radius;

        if (ocol.shape === ColliderShapeType.Circle) {
            const ox = otr.x + ocol.offsetX;
            const oy = otr.y + ocol.offsetY;
            const rr = ocol.radius;
            const dx = cx - ox;
            const dy = cy - oy;
            const distSq = dx * dx + dy * dy;
            const minDist = r + rr;
            if (distSq >= minDist * minDist) return false;
            const dist = Math.sqrt(Math.max(1e-8, distSq));
            const nx = dx / dist;
            const ny = dy / dist;
            const push = minDist - dist;
            tr.x += nx * push;
            tr.y += ny * push;
            return true;
        }

        if (ocol.shape === ColliderShapeType.AABB) {
            const halfW = ocol.width * 0.5;
            const halfH = ocol.height * 0.5;
            const rx = otr.x + ocol.offsetX;
            const ry = otr.y + ocol.offsetY;
            const minX = rx - halfW;
            const maxX = rx + halfW;
            const minY = ry - halfH;
            const maxY = ry + halfH;

            const closestX = clamp(cx, minX, maxX);
            const closestY = clamp(cy, minY, maxY);
            const dx = cx - closestX;
            const dy = cy - closestY;
            const distSq = dx * dx + dy * dy;
            if (distSq > r * r) return false;

            if (distSq > 1e-8) {
                const dist = Math.sqrt(distSq);
                const nx = dx / dist;
                const ny = dy / dist;
                const push = r - dist;
                tr.x += nx * push;
                tr.y += ny * push;
                return true;
            }

            const toLeft = cx - minX;
            const toRight = maxX - cx;
            const toBottom = cy - minY;
            const toTop = maxY - cy;

            const minSide = Math.min(toLeft, toRight, toBottom, toTop);
            if (minSide === toLeft) tr.x += r;
            else if (minSide === toRight) tr.x -= r;
            else if (minSide === toBottom) tr.y += r;
            else tr.y -= r;
            return true;
        }

        return false;
    }

    private rayCheckObstacles(startX: number, startY: number, dx: number, dy: number, radius: number): boolean {
        const endX = startX + dx;
        const endY = startY + dy;

        const queryRange: SpatialHashRect = {
            x: Math.min(startX, endX) - radius,
            y: Math.min(startY, endY) - radius,
            width: Math.abs(endX - startX) + radius * 2,
            height: Math.abs(endY - startY) + radius * 2
        };
        const candidates = this.spatialHash.query(queryRange);
        for (const candidate of candidates) {
            if (this.rayIntersectsObstacle(startX, startY, dx, dy, radius, candidate.transform, candidate.collider)) {
                return true;
            }
        }

        return false;
    }

    private rayIntersectsObstacle(
        startX: number, startY: number, dx: number, dy: number, radius: number,
        otr: TransformComponent, ocol: ColliderComponent
    ): boolean {
        if (ocol.shape === ColliderShapeType.Circle) {
            const ox = otr.x + ocol.offsetX;
            const oy = otr.y + ocol.offsetY;
            const rr = ocol.radius + radius;

            const fx = startX - ox;
            const fy = startY - oy;

            const a = dx * dx + dy * dy;
            const b = 2 * (fx * dx + fy * dy);
            const c = fx * fx + fy * fy - rr * rr;

            const discriminant = b * b - 4 * a * c;
            if (discriminant < 0) return false;

            const sqrtDisc = Math.sqrt(discriminant);
            const t1 = (-b - sqrtDisc) / (2 * a);
            const t2 = (-b + sqrtDisc) / (2 * a);

            return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
        }

        if (ocol.shape === ColliderShapeType.AABB) {
            const halfW = ocol.width * 0.5;
            const halfH = ocol.height * 0.5;
            const rx = otr.x + ocol.offsetX;
            const ry = otr.y + ocol.offsetY;

            const minX = rx - halfW - radius;
            const maxX = rx + halfW + radius;
            const minY = ry - halfH - radius;
            const maxY = ry + halfH + radius;

            return this.rayIntersectsRect(startX, startY, dx, dy, minX, maxX, minY, maxY);
        }

        return false;
    }

    private rayIntersectsRect(
        startX: number, startY: number, dx: number, dy: number,
        minX: number, maxX: number, minY: number, maxY: number
    ): boolean {
        if (startX >= minX && startX <= maxX && startY >= minY && startY <= maxY) {
            return true;
        }

        let tmin = 0;
        let tmax = 1;

        if (dx !== 0) {
            const t1 = (minX - startX) / dx;
            const t2 = (maxX - startX) / dx;
            tmin = Math.max(tmin, Math.min(t1, t2));
            tmax = Math.min(tmax, Math.max(t1, t2));
        } else {
            if (startX < minX || startX > maxX) return false;
        }

        if (dy !== 0) {
            const t1 = (minY - startY) / dy;
            const t2 = (maxY - startY) / dy;
            tmin = Math.max(tmin, Math.min(t1, t2));
            tmax = Math.min(tmax, Math.max(t1, t2));
        } else {
            if (startY < minY || startY > maxY) return false;
        }

        return tmin <= tmax;
    }
}

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}