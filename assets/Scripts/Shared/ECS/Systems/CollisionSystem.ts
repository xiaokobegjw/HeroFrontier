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

                if (other.id <= item.id) continue;
                if (!this.layerPass(item.entity, other.entity)) continue;
                if (this.intersects(item.entity, other.entity)) {

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

        const rad = (transform.rotation * Math.PI) / 180;
        const hw = collider.width / 2;
        const hh = collider.height / 2;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const points = [
            { x: x + cos * (-hw) - sin * (-hh), y: y + sin * (-hw) + cos * (-hh) },
            { x: x + cos * (hw) - sin * (-hh), y: y + sin * (hw) + cos * (-hh) },
            { x: x + cos * (hw) - sin * (hh), y: y + sin * (hw) + cos * (hh) },
            { x: x + cos * (-hw) - sin * (hh), y: y + sin * (-hw) + cos * (hh) },
        ];

        let minX = points[0].x, maxX = points[0].x;
        let minY = points[0].y, maxY = points[0].y;
        for (const p of points) {
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }

        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
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

        if (ca.shape === ColliderShapeType.Circle && cb.shape === ColliderShapeType.AABB) {
            return this.circleOBBIntersects(ax, ay, ca.radius, bx, by, cb.width, cb.height, tb.rotation);
        }

        if (ca.shape === ColliderShapeType.AABB && cb.shape === ColliderShapeType.Circle) {
            return this.circleOBBIntersects(bx, by, cb.radius, ax, ay, ca.width, ca.height, ta.rotation);
        }

        if (ca.shape === ColliderShapeType.AABB && cb.shape === ColliderShapeType.AABB) {
            return this.obbIntersects(ax, ay, ca.width, ca.height, ta.rotation, bx, by, cb.width, cb.height, tb.rotation);
        }

        return false;
    }

    private circleOBBIntersects(cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number, rRot: number): boolean {
        const rad = (rRot * Math.PI) / 180;
        const cos = Math.cos(-rad);
        const sin = Math.sin(-rad);

        const dx = cx - rx;
        const dy = cy - ry;
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        const hw = rw / 2;
        const hh = rh / 2;
        const closestX = Math.max(-hw, Math.min(localX, hw));
        const closestY = Math.max(-hh, Math.min(localY, hh));

        const distX = localX - closestX;
        const distY = localY - closestY;
        return distX * distX + distY * distY <= cr * cr;
    }

    private obbIntersects(ax: number, ay: number, aw: number, ah: number, aRot: number, bx: number, by: number, bw: number, bh: number, bRot: number): boolean {
        const aRad = (aRot * Math.PI) / 180;
        const bRad = (bRot * Math.PI) / 180;

        const aCos = Math.cos(aRad);
        const aSin = Math.sin(aRad);
        const bCos = Math.cos(bRad);
        const bSin = Math.sin(bRad);

        const aHalfW = aw / 2;
        const aHalfH = ah / 2;
        const bHalfW = bw / 2;
        const bHalfH = bh / 2;

        const aPoints = [
            { x: ax + aCos * (-aHalfW) - aSin * (-aHalfH), y: ay + aSin * (-aHalfW) + aCos * (-aHalfH) },
            { x: ax + aCos * (aHalfW) - aSin * (-aHalfH), y: ay + aSin * (aHalfW) + aCos * (-aHalfH) },
            { x: ax + aCos * (aHalfW) - aSin * (aHalfH), y: ay + aSin * (aHalfW) + aCos * (aHalfH) },
            { x: ax + aCos * (-aHalfW) - aSin * (aHalfH), y: ay + aSin * (-aHalfW) + aCos * (aHalfH) },
        ];

        const bPoints = [
            { x: bx + bCos * (-bHalfW) - bSin * (-bHalfH), y: by + bSin * (-bHalfW) + bCos * (-bHalfH) },
            { x: bx + bCos * (bHalfW) - bSin * (-bHalfH), y: by + bSin * (bHalfW) + bCos * (-bHalfH) },
            { x: bx + bCos * (bHalfW) - bSin * (bHalfH), y: by + bSin * (bHalfW) + bCos * (bHalfH) },
            { x: bx + bCos * (-bHalfW) - bSin * (bHalfH), y: by + bSin * (-bHalfW) + bCos * (bHalfH) },
        ];

        const axes = [
            { x: aCos, y: aSin },
            { x: -aSin, y: aCos },
            { x: bCos, y: bSin },
            { x: -bSin, y: bCos },
        ];

        for (const axis of axes) {
            let aMin = Infinity, aMax = -Infinity;
            let bMin = Infinity, bMax = -Infinity;

            for (const p of aPoints) {
                const proj = p.x * axis.x + p.y * axis.y;
                aMin = Math.min(aMin, proj);
                aMax = Math.max(aMax, proj);
            }

            for (const p of bPoints) {
                const proj = p.x * axis.x + p.y * axis.y;
                bMin = Math.min(bMin, proj);
                bMax = Math.max(bMax, proj);
            }

            if (aMax < bMin || bMax < aMin) {
                return false;
            }
        }

        return true;
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

    public testCollision(entityA: Entity, entityB: Entity): boolean {
        return this.intersects(entityA, entityB);
    }
}
