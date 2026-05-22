import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { QuadTree, QuadTreeRect } from '../../../Shared/Spatial/QuadTree';
import { MoveStatsComponent } from '../Components/MoveStatsComponent';
import { ObstacleComponent } from '../Components/ObstacleComponent';

type ObstacleItem = {
    id: number;
    entity: Entity;
    bounds: QuadTreeRect;
};

export class MovementBlockSystem extends ECSSystem {
    private world: World;
    private obstacleIndex: QuadTree<ObstacleItem> | null = null;
    private obstacleSignature: string = '';

    constructor(world: World, priority: number = 4.85) {
        super('MovementBlockSystem', priority);
        this.world = world;
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
        if (!this.obstacleIndex) return;

        for (const entity of entities) {
            if (!entity.active) continue;
            if (entity.hasComponent(ObstacleComponent)) continue;
            const tr = entity.getComponent(TransformComponent);
            const col = entity.getComponent(ColliderComponent);
            if (!tr || !col) continue;
            if (col.shape !== ColliderShapeType.Circle) continue;

            for (let iter = 0; iter < 4; iter++) {
                const queryRange = this.getAABB(tr, col);
                const candidates = this.obstacleIndex.query(queryRange, []);
                if (candidates.length === 0) break;

                let moved = false;
                for (const candidate of candidates) {
                    moved = this.resolveAgainstObstacle(entity, candidate.entity) || moved;
                }
                if (!moved) break;
            }
        }
    }

    private refreshObstacleIndex(obstacles: Entity[]): void {
        const items = obstacles.map(entity => {
            const tr = entity.getComponent(TransformComponent)!;
            const col = entity.getComponent(ColliderComponent)!;
            return {
                id: entity.id,
                entity,
                bounds: this.getAABB(tr, col)
            };
        });

        const signature = items
            .map(item => {
                const b = item.bounds;
                return `${item.id}:${b.x.toFixed(1)},${b.y.toFixed(1)},${b.width.toFixed(1)},${b.height.toFixed(1)}`;
            })
            .join('|');

        if (this.obstacleIndex && signature === this.obstacleSignature) return;

        const bounds = this.computeTreeBounds(items);
        this.obstacleIndex = new QuadTree<ObstacleItem>(bounds, { capacity: 8, maxDepth: 8 });
        for (const item of items) {
            this.obstacleIndex.insert(item);
        }
        this.obstacleSignature = signature;
    }

    private computeTreeBounds(items: ObstacleItem[]): QuadTreeRect {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const item of items) {
            minX = Math.min(minX, item.bounds.x);
            minY = Math.min(minY, item.bounds.y);
            maxX = Math.max(maxX, item.bounds.x + item.bounds.width);
            maxY = Math.max(maxY, item.bounds.y + item.bounds.height);
        }

        if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
            return { x: -1000, y: -1000, width: 2000, height: 2000 };
        }

        const pad = 32;
        return {
            x: minX - pad,
            y: minY - pad,
            width: Math.max(64, maxX - minX + pad * 2),
            height: Math.max(64, maxY - minY + pad * 2)
        };
    }

    private getAABB(transform: TransformComponent, collider: ColliderComponent): QuadTreeRect {
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
}

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}
