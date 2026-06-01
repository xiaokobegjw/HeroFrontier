import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { ActionSystem } from '../../../Shared/ECS/Systems/ActionSystem';
import { WalkAction } from '../../../Shared/ECS/Actions/WalkAction';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { TargetComponent } from '../Components/TargetComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { SpatialIndexSystem } from './SpatialIndexSystem';
import { ObstacleComponent } from '../Components/ObstacleComponent';
import { FactionType } from '../../Data/Faction';
import { SoldierComponent } from '../Components/SoldierComponent';

type Rect = { x: number; y: number; width: number; height: number };

export class IdleFriendlySpacingSystem extends ECSSystem {
    private world: World;
    private actionSystem: ActionSystem;

    private minX: number = -1000;
    private maxX: number = 1000;
    private minY: number = -1000;
    private maxY: number = 1000;

    private timeSeconds: number = 0;
    private tickInterval: number = 0.6;
    private repositionCooldown: number = 2.2;
    private lastRepositionTime: Map<number, number> = new Map();
    private overlapSince: Map<number, number> = new Map();
    private overlapConfirmSeconds: number = 0.8;

    private enemyClearRadius: number = 260;
    private friendlyQueryRadiusMin: number = 40;

    constructor(world: World, actionSystem: ActionSystem, priority: number = 6.25) {
        super('IdleFriendlySpacingSystem', priority);
        this.world = world;
        this.actionSystem = actionSystem;
    }

    public setBounds(minX: number, maxX: number, minY: number, maxY: number): void {
        if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) return;
        if (maxX <= minX || maxY <= minY) return;
        this.minX = minX;
        this.maxX = maxX;
        this.minY = minY;
        this.maxY = maxY;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, ColliderComponent, HealthComponent, TargetComponent, FactionComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        this.timeSeconds += Math.max(0, deltaTime);

        const spatial = this.world.getSystem(SpatialIndexSystem);
        if (!spatial) return;

        const tick = this.tickInterval * (0.85 + rand01(123, Math.floor(this.timeSeconds * 1000)) * 0.3);
        if ((this.timeSeconds % tick) > deltaTime) return;

        const obstacles = this.getBlockingObstacles();
        const reservedTargets: { x: number; y: number; r: number }[] = [];

        for (const e of entities) {
            if (!e.active) continue;

            const hp = e.getComponent(HealthComponent);
            if (!hp || hp.isDead) continue;

            const target = e.getComponent(TargetComponent);
            if (!target || target.targetEntityId !== null) continue;

            if (!this.actionSystem.isIdle(e)) continue;

            const last = this.lastRepositionTime.get(e.id) ?? -9999;
            if (this.timeSeconds - last < this.repositionCooldown) continue;

            const fac = e.getComponent(FactionComponent);
            const tr = e.getComponent(TransformComponent);
            const col = e.getComponent(ColliderComponent);
            if (!fac || !tr || !col || col.shape !== ColliderShapeType.Circle) continue;
            if (fac.faction !== FactionType.Player && fac.faction !== FactionType.Enemy) continue;
            if (fac.faction === FactionType.Player && e.hasComponent(SoldierComponent)) continue;

            const cx = tr.x + col.offsetX;
            const cy = tr.y + col.offsetY;
            const r = Math.max(0, col.radius);

            if (!this.isAreaEnemyClear(spatial, fac.faction, cx, cy, this.enemyClearRadius)) continue;

            const friendlyQueryR = Math.max(this.friendlyQueryRadiusMin, r + 24);
            const friendIds = spatial.queryFaction(fac.faction, rectAround(cx, cy, friendlyQueryR));
            let sumAwayX = 0;
            let sumAwayY = 0;
            let overlapCount = 0;

            for (const id of friendIds) {
                if (id === e.id) continue;
                const other = this.world.getEntity(id);
                if (!other || !other.active) continue;
                const oh = other.getComponent(HealthComponent);
                if (!oh || oh.isDead) continue;
                const ot = other.getComponent(TransformComponent);
                const oc = other.getComponent(ColliderComponent);
                if (!ot || !oc || oc.shape !== ColliderShapeType.Circle) continue;

                const ocx = ot.x + oc.offsetX;
                const ocy = ot.y + oc.offsetY;
                const or = Math.max(0, oc.radius);

                const dx = cx - ocx;
                const dy = cy - ocy;
                const dsq = dx * dx + dy * dy;
                const minDist = (r + or) * 0.9;
                if (dsq >= minDist * minDist) continue;

                const d = Math.sqrt(Math.max(1e-6, dsq));
                sumAwayX += dx / d;
                sumAwayY += dy / d;
                overlapCount++;
            }

            if (overlapCount === 0) {
                this.overlapSince.delete(e.id);
                continue;
            }

            const since = this.overlapSince.get(e.id);
            if (since === undefined) {
                this.overlapSince.set(e.id, this.timeSeconds);
                continue;
            }
            if (this.timeSeconds - since < this.overlapConfirmSeconds) continue;

            let dirX = sumAwayX;
            let dirY = sumAwayY;
            const len = Math.sqrt(dirX * dirX + dirY * dirY);
            if (len > 1e-6) {
                dirX /= len;
                dirY /= len;
            } else {
                const n = pairUnit(e.id, overlapCount);
                dirX = n.x;
                dirY = n.y;
            }

            const isSoldier = !!e.getComponent(SoldierComponent);
            const baseStep = isSoldier ? Math.max(12, (r + 2) * 4) : Math.max(16, (r + 4) * 6);
            const attempts = isSoldier ? 8 : 12;

            let chosen: { x: number; y: number } | null = null;
            for (let i = 0; i < attempts; i++) {
                const dist = baseStep + i * 10;
                const side = ((e.id + i) & 1) === 0 ? 1 : -1;
                const px = -dirY * side;
                const py = dirX * side;

                const n = pairUnit(e.id, i + 1);
                const jitterX = n.x * (4 + (i % 3) * 3);
                const jitterY = n.y * (4 + ((i + 1) % 3) * 3);

                const tx = cx + dirX * dist + px * (6 + (i % 3) * 6) + jitterX;
                const ty = cy + dirY * dist + py * (6 + ((i + 1) % 3) * 6) + jitterY;

                const clamped = this.clampCenterToBounds(tx, ty, r);
                if (!this.isCircleWalkable(clamped.x, clamped.y, r, obstacles)) continue;

                let reservedOk = true;
                for (const rt of reservedTargets) {
                    const dx = clamped.x - rt.x;
                    const dy = clamped.y - rt.y;
                    const minDist = (r + rt.r) * 0.9;
                    if (dx * dx + dy * dy < minDist * minDist) {
                        reservedOk = false;
                        break;
                    }
                }
                if (!reservedOk) continue;

                chosen = clamped;
                reservedTargets.push({ x: clamped.x, y: clamped.y, r });
                break;
            }

            if (!chosen) continue;

            this.lastRepositionTime.set(e.id, this.timeSeconds);
            this.overlapSince.delete(e.id);
            this.actionSystem.setSingleAction(e, new WalkAction(e, { x: chosen.x - col.offsetX, y: chosen.y - col.offsetY }));
        }
    }

    private isAreaEnemyClear(spatial: SpatialIndexSystem, selfFaction: FactionType, x: number, y: number, r: number): boolean {
        const rect = rectAround(x, y, r);
        if (selfFaction === FactionType.Player) {
            return spatial.queryFaction(FactionType.Enemy, rect).length === 0;
        }
        if (selfFaction === FactionType.Enemy) {
            return spatial.queryFaction(FactionType.Player, rect).length === 0;
        }
        return spatial.queryOpponents(selfFaction, rect).length === 0;
    }

    private clampCenterToBounds(cx: number, cy: number, r: number): { x: number; y: number } {
        const minCx = this.minX + r;
        const maxCx = this.maxX - r;
        const minCy = this.minY + r;
        const maxCy = this.maxY - r;
        return { x: clamp(cx, minCx, maxCx), y: clamp(cy, minCy, maxCy) };
    }

    private getBlockingObstacles(): Entity[] {
        return this.world
            .getAllEntities()
            .filter(e => e.active && e.hasComponent(ObstacleComponent) && e.hasComponent(TransformComponent) && e.hasComponent(ColliderComponent))
            .filter(e => e.getComponent(ObstacleComponent)!.blocksMovement);
    }

    private isCircleWalkable(cx: number, cy: number, r: number, obstacles: Entity[]): boolean {
        const rr = r * r;
        for (const obs of obstacles) {
            const ot = obs.getComponent(TransformComponent);
            const oc = obs.getComponent(ColliderComponent);
            if (!ot || !oc) continue;
            const ox = oc.offsetX ?? 0;
            const oy = oc.offsetY ?? 0;

            if (oc.shape === ColliderShapeType.AABB) {
                const halfW = Math.max(0, oc.width) * 0.5;
                const halfH = Math.max(0, oc.height) * 0.5;
                const rx = ot.x + ox;
                const ry = ot.y + oy;
                const minX = rx - halfW;
                const maxX = rx + halfW;
                const minY = ry - halfH;
                const maxY = ry + halfH;
                const closestX = clamp(cx, minX, maxX);
                const closestY = clamp(cy, minY, maxY);
                const dx = cx - closestX;
                const dy = cy - closestY;
                if (dx * dx + dy * dy <= rr) return false;
            } else if (oc.shape === ColliderShapeType.Circle) {
                const or = Math.max(0, oc.radius);
                const dx = cx - (ot.x + ox);
                const dy = cy - (ot.y + oy);
                const minDist = r + or;
                if (dx * dx + dy * dy <= minDist * minDist) return false;
            }
        }
        return true;
    }
}

function rectAround(x: number, y: number, r: number): Rect {
    return { x: x - r, y: y - r, width: r * 2, height: r * 2 };
}

function clamp(v: number, min: number, max: number): number {
    if (min > max) return v;
    return Math.max(min, Math.min(max, v));
}

function rand01(a: number, b: number): number {
    let x = (a ^ b) >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
}

function pairUnit(a: number, b: number): { x: number; y: number } {
    let x = (a * 1103515245 + b * 12345) >>> 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    const t = (x >>> 0) / 4294967296;
    const ang = t * Math.PI * 2;
    return { x: Math.cos(ang), y: Math.sin(ang) };
}
