import { ECSSystem } from '../Core/ECSSystem';
import { Entity } from '../Core/Entity';
import { ECSComponent } from '../Core/ECSComponent';
import { TransformComponent } from '../Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../Components/ColliderComponent';
import { QuadTree } from '../../Spatial/QuadTree';

type Rect = { x: number; y: number; width: number; height: number };
type Indexed = { id: number; bounds: Rect; entity: Entity };

export type CollisionEvent = { aId: number; bId: number };

export class CollisionSystem extends ECSSystem {
    private events: CollisionEvent[] = [];

    private index: QuadTree<Indexed>;
    private readonly worldBounds: Rect;
    private lastIndexed: { id: number; bounds: Rect }[] = [];

    constructor(priority: number = 10, worldBounds: Rect = { x: 0, y: 0, width: 2000, height: 2000 }) {
        super('CollisionSystem', priority);
        this.worldBounds = worldBounds;
        this.index = new QuadTree<Indexed>(worldBounds, { capacity: 8, maxDepth: 8 });
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, ColliderComponent];
    }

    public drainEvents(): CollisionEvent[] {
        const out = this.events;
        this.events = [];
        return out;
    }

    public debugTraverseIndex(visitor: (bounds: Rect, depth: number, itemCount: number, divided: boolean) => void, includeEmpty: boolean = true): void {
        this.index.debugTraverse(visitor as any, includeEmpty);
    }

    public debugGetIndexItems(): { id: number; bounds: Rect }[] {
        return this.lastIndexed;
    }

    public update(entities: Entity[], deltaTime: number): void {
        this.index.clear();
        this.events.length = 0;

        const indexed: Indexed[] = [];
        for (const entity of entities) {
            const transform = entity.getComponent(TransformComponent);
            const collider = entity.getComponent(ColliderComponent);
            if (!transform || !collider) continue;

            const bounds = this.getAABB(transform, collider);
            const item: Indexed = { id: entity.id, bounds, entity };
            indexed.push(item);
            this.index.insert(item);
        }
        this.lastIndexed = indexed.map(it => ({ id: it.id, bounds: it.bounds }));

        for (const item of indexed) {
            const candidates = this.index.query(item.bounds);
            for (const other of candidates) {

                const isSkyShockwave = item.entity.name.includes('SkyShockwave') || other.entity.name.includes('SkyShockwave');
                if (isSkyShockwave) {
                    let fdasfd = 0
                    fdasfd++;
                }

                if (other.id <= item.id) continue;
                if (!this.layerPass(item.entity, other.entity)) continue;
                if (this.intersects(item.entity, other.entity)) {

                    const isSkyShockwave = item.entity.name.includes('SkyShockwave') || other.entity.name.includes('SkyShockwave');
                    if (isSkyShockwave) {
                        let fdasfd = 0
                        fdasfd++;
                    }

                    this.events.push({ aId: item.id, bId: other.id });
                }
            }
        }
    }

    private layerPass(a: Entity, b: Entity): boolean {
        const ca = a.getComponent(ColliderComponent);
        const cb = b.getComponent(ColliderComponent);
        if (!ca || !cb) return false;
        return (ca.mask & cb.layer) !== 0 && (cb.mask & ca.layer) !== 0;
    }

    private getAABB(transform: TransformComponent, collider: ColliderComponent): Rect {
        const x = transform.x + collider.offsetX;
        const y = transform.y + collider.offsetY;

        if (collider.shape === ColliderShapeType.Circle) {
            const r = collider.radius;
            return { x: x - r, y: y - r, width: r * 2, height: r * 2 };
        }

        return { x: x - collider.width / 2, y: y - collider.height / 2, width: collider.width, height: collider.height };
    }

    private intersects(a: Entity, b: Entity): boolean {
        const ta = a.getComponent(TransformComponent);
        const tb = b.getComponent(TransformComponent);
        const ca = a.getComponent(ColliderComponent);
        const cb = b.getComponent(ColliderComponent);
        if (!ta || !tb || !ca || !cb) return false;

        const ax = ta.x + ca.offsetX;
        const ay = ta.y + ca.offsetY;
        const bx = tb.x + cb.offsetX;
        const by = tb.y + cb.offsetY;

        if (ca.shape === ColliderShapeType.Circle && cb.shape === ColliderShapeType.Circle) {
            const dx = ax - bx;
            const dy = ay - by;
            const r = ca.radius + cb.radius;
            return dx * dx + dy * dy <= r * r;
        }

        const aRect = this.getAABB(ta, ca);
        const bRect = this.getAABB(tb, cb);

        if (ca.shape === ColliderShapeType.AABB && cb.shape === ColliderShapeType.AABB) {
            return this.rectIntersects(aRect, bRect);
        }

        if (ca.shape === ColliderShapeType.Circle && cb.shape === ColliderShapeType.AABB) {
            return this.circleRectIntersects(ax, ay, ca.radius, bRect);
        }

        if (ca.shape === ColliderShapeType.AABB && cb.shape === ColliderShapeType.Circle) {
            return this.circleRectIntersects(bx, by, cb.radius, aRect);
        }

        return false;
    }

    private rectIntersects(a: Rect, b: Rect): boolean {
        return !(
            b.x > a.x + a.width ||
            b.x + b.width < a.x ||
            b.y > a.y + a.height ||
            b.y + b.height < a.y
        );
    }

    private circleRectIntersects(cx: number, cy: number, r: number, rect: Rect): boolean {
        const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
        const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
        const dx = cx - closestX;
        const dy = cy - closestY;
        return dx * dx + dy * dy <= r * r;
    }
}
