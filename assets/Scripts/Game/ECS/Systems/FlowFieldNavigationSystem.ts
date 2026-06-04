import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { ActionSystem } from '../../../Shared/ECS/Systems/ActionSystem';
import { WalkAction } from '../../../Shared/ECS/Actions/WalkAction';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { TargetComponent } from '../Components/TargetComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { SpatialIndexSystem } from './SpatialIndexSystem';
import { PathFollowComponent } from '../Components/PathFollowComponent';
import { MoveStatsComponent } from '../Components/MoveStatsComponent';
import { ObstacleComponent } from '../Components/ObstacleComponent';
import { FactionType } from '../../Data/Faction';
import { TowerComponent } from '../Components/TowerComponent';

type GridConfig = {
    cellSize: number;
    gridW: number;
    gridH: number;
    levelW: number;
    levelH: number;
    legacyTopLeft: boolean;
    walkable?: number[] | null;
};

export class FlowFieldNavigationSystem extends ECSSystem {
    private world: World;
    private actionSystem: ActionSystem;
    private getBaseEntityId: () => number | null;

    private grid: GridConfig | null = null;
    private dirty: boolean = true;
    private walkableMask: Uint8Array | null = null;
    private integration: Int32Array | null = null;
    private dirX: Int8Array | null = null;
    private dirY: Int8Array | null = null;
    private targetIndex: number = -1;

    constructor(world: World, actionSystem: ActionSystem, getBaseEntityId: () => number | null, priority: number = 6.1) {
        super('FlowFieldNavigationSystem', priority);
        this.world = world;
        this.actionSystem = actionSystem;
        this.getBaseEntityId = getBaseEntityId;
    }

    public configureGrid(cfg: GridConfig): void {
        if (!Number.isFinite(cfg.cellSize) || cfg.cellSize <= 0) return;
        if (!Number.isFinite(cfg.gridW) || cfg.gridW <= 0) return;
        if (!Number.isFinite(cfg.gridH) || cfg.gridH <= 0) return;
        if (!Number.isFinite(cfg.levelW) || cfg.levelW <= 0) return;
        if (!Number.isFinite(cfg.levelH) || cfg.levelH <= 0) return;
        this.grid = {
            cellSize: Math.max(1, Math.floor(cfg.cellSize)),
            gridW: Math.max(1, Math.floor(cfg.gridW)),
            gridH: Math.max(1, Math.floor(cfg.gridH)),
            levelW: cfg.levelW,
            levelH: cfg.levelH,
            legacyTopLeft: !!cfg.legacyTopLeft,
            walkable: Array.isArray(cfg.walkable) ? cfg.walkable : null
        };
        this.allocate();
        this.dirty = true;
    }

    public markDirty(): void {
        this.dirty = true;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, TargetComponent, FactionComponent, PathFollowComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        void deltaTime;
        if (!this.grid || !this.walkableMask || !this.integration || !this.dirX || !this.dirY) return;

        if (this.dirty) this.rebuildFlowField();
        if (this.targetIndex < 0) return;

        const spatial = this.world.getSystem(SpatialIndexSystem);

        for (const entity of entities) {
            if (!entity.active) continue;

            const transform = entity.getComponent(TransformComponent);
            const target = entity.getComponent(TargetComponent);
            const faction = entity.getComponent(FactionComponent);
            if (!transform || !target || !faction) continue;
            if (faction.faction !== FactionType.Enemy) continue;

            const hasAnyTarget =
                target.targetEntityId !== null || (Number.isFinite(target.targetX) && Number.isFinite(target.targetY));
            if (hasAnyTarget) continue;

            if (spatial) {
                const selfR = approxRadius(entity.getComponent(ColliderComponent));
                const r = Math.max(8, selfR + 6);
                const ids = spatial.queryOpponents(faction.faction, {
                    x: transform.x - r,
                    y: transform.y - r,
                    width: r * 2,
                    height: r * 2
                });
                let best: { id: number; dsq: number; x: number; y: number } | null = null;
                for (const id of ids) {
                    const other = this.world.getEntity(id);
                    if (!other || !other.active) continue;
                    if (other.hasComponent(TowerComponent)) continue;
                    const ot = other.getComponent(TransformComponent);
                    if (!ot) continue;
                    const dx = ot.x - transform.x;
                    const dy = ot.y - transform.y;
                    const dsq = dx * dx + dy * dy;
                    if (!best || dsq < best.dsq) best = { id, dsq, x: ot.x, y: ot.y };
                }
                if (best) {
                    target.targetEntityId = best.id;
                    target.targetX = best.x;
                    target.targetY = best.y;
                    target.lockedUntilTime = 0;
                    continue;
                }
            }

            if (this.tryAcquireBaseAsTarget(entity, transform, target)) continue;
            this.stepAlongFlow(entity, transform);
        }
    }

    private allocate(): void {
        if (!this.grid) return;
        const n = this.grid.gridW * this.grid.gridH;
        this.walkableMask = new Uint8Array(n);
        this.integration = new Int32Array(n);
        this.dirX = new Int8Array(n);
        this.dirY = new Int8Array(n);
        this.targetIndex = -1;
    }

    private rebuildFlowField(): void {
        if (!this.grid || !this.walkableMask || !this.integration || !this.dirX || !this.dirY) return;

        this.dirty = false;
        const { gridW, gridH } = this.grid;
        const n = gridW * gridH;

        const baseWalkable = this.grid.walkable;
        if (baseWalkable && baseWalkable.length === n) {
            for (let i = 0; i < n; i++) {
                this.walkableMask[i] = baseWalkable[i] ? 1 : 0;
            }
        } else {
            this.walkableMask.fill(1);
        }

        this.applyObstacleBlocks();

        const baseId = this.getBaseEntityId();
        const baseEnt = baseId !== null ? this.world.getEntity(baseId) : null;
        const baseTr = baseEnt?.getComponent(TransformComponent) ?? null;
        if (!baseTr) {
            this.targetIndex = -1;
            return;
        }

        const t = this.worldToGrid(baseTr.x, baseTr.y);
        const startIndex = t ? t.gy * gridW + t.gx : -1;
        const targetIndex = this.findNearestWalkableIndex(startIndex);
        if (targetIndex < 0) {
            this.targetIndex = -1;
            return;
        }
        this.targetIndex = targetIndex;

        const INF = 1_000_000_000;
        this.integration.fill(INF);
        this.dirX.fill(0);
        this.dirY.fill(0);

        const q = new Int32Array(n);
        this.integration[targetIndex] = 0;
        let qh = 0;
        let qt = 0;
        q[qt++] = targetIndex;
        while (qh < qt) {
            const idx = q[qh++];
            const baseCost = this.integration[idx];
            const x = idx % gridW;
            const y = (idx / gridW) | 0;
            qt = this.relaxNeighborIndex(y > 0 ? idx - gridW : -1, baseCost, q, qt, INF);
            qt = this.relaxNeighborIndex(x + 1 < gridW ? idx + 1 : -1, baseCost, q, qt, INF);
            qt = this.relaxNeighborIndex(y + 1 < gridH ? idx + gridW : -1, baseCost, q, qt, INF);
            qt = this.relaxNeighborIndex(x > 0 ? idx - 1 : -1, baseCost, q, qt, INF);
        }

        for (let gy = 0; gy < gridH; gy++) {
            for (let gx = 0; gx < gridW; gx++) {
                const idx = gy * gridW + gx;
                if (this.walkableMask[idx] === 0) continue;
                const c = this.integration[idx];
                if (c >= INF) continue;
                if (idx === targetIndex) continue;

                let best = c;
                let bestDx = 0;
                let bestDy = 0;

                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = gx + dx;
                        const ny = gy + dy;
                        if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
                        const nidx = ny * gridW + nx;
                        if (this.walkableMask[nidx] === 0) continue;
                        const nc = this.integration[nidx];
                        if (nc < best) {
                            best = nc;
                            bestDx = dx;
                            bestDy = dy;
                        }
                    }
                }
                this.dirX[idx] = bestDx;
                this.dirY[idx] = bestDy;
            }
        }
    }

    private relaxNeighborIndex(nidx: number, baseCost: number, q: Int32Array, qt: number, inf: number): number {
        if (nidx < 0) return qt;
        if (!this.walkableMask || !this.integration) return qt;
        if (this.walkableMask[nidx] === 0) return qt;
        if (this.integration[nidx] !== inf) return qt;
        const nextCost = baseCost + 1;
        this.integration[nidx] = nextCost;
        q[qt] = nidx;
        return qt + 1;
    }

    private applyObstacleBlocks(): void {
        if (!this.grid || !this.walkableMask) return;
        const { gridW, gridH } = this.grid;
        const obs = this.world
            .getAllEntities()
            .filter(e => e.active && e.hasComponent(ObstacleComponent) && e.hasComponent(TransformComponent) && e.hasComponent(ColliderComponent))
            .filter(e => e.getComponent(ObstacleComponent)!.blocksMovement);

        for (const e of obs) {
            const tr = e.getComponent(TransformComponent)!;
            const col = e.getComponent(ColliderComponent)!;
            const ox = col.offsetX ?? 0;
            const oy = col.offsetY ?? 0;

            if (col.shape === ColliderShapeType.AABB) {
                const halfW = Math.max(0, col.width) * 0.5;
                const halfH = Math.max(0, col.height) * 0.5;
                const minX = tr.x + ox - halfW;
                const maxX = tr.x + ox + halfW;
                const minY = tr.y + oy - halfH;
                const maxY = tr.y + oy + halfH;
                const a = this.worldToGrid(minX, minY);
                const b = this.worldToGrid(maxX, maxY);
                if (!a || !b) continue;
                const gx0 = clampInt(Math.min(a.gx, b.gx), 0, gridW - 1);
                const gx1 = clampInt(Math.max(a.gx, b.gx), 0, gridW - 1);
                const gy0 = clampInt(Math.min(a.gy, b.gy), 0, gridH - 1);
                const gy1 = clampInt(Math.max(a.gy, b.gy), 0, gridH - 1);
                for (let gy = gy0; gy <= gy1; gy++) {
                    for (let gx = gx0; gx <= gx1; gx++) {
                        this.walkableMask[gy * gridW + gx] = 0;
                    }
                }
                continue;
            }

            if (col.shape === ColliderShapeType.Circle) {
                const r = Math.max(0, col.radius);
                const minX = tr.x + ox - r;
                const maxX = tr.x + ox + r;
                const minY = tr.y + oy - r;
                const maxY = tr.y + oy + r;
                const a = this.worldToGrid(minX, minY);
                const b = this.worldToGrid(maxX, maxY);
                if (!a || !b) continue;
                const gx0 = clampInt(Math.min(a.gx, b.gx), 0, gridW - 1);
                const gx1 = clampInt(Math.max(a.gx, b.gx), 0, gridW - 1);
                const gy0 = clampInt(Math.min(a.gy, b.gy), 0, gridH - 1);
                const gy1 = clampInt(Math.max(a.gy, b.gy), 0, gridH - 1);
                for (let gy = gy0; gy <= gy1; gy++) {
                    for (let gx = gx0; gx <= gx1; gx++) {
                        this.walkableMask[gy * gridW + gx] = 0;
                    }
                }
            }
        }
    }

    private worldToGrid(x: number, y: number): { gx: number; gy: number } | null {
        if (!this.grid) return null;
        const { cellSize, gridW, gridH, levelW, levelH, legacyTopLeft } = this.grid;
        const px = x + levelW * 0.5;
        const py = legacyTopLeft ? (levelH * 0.5 - y) : (y + levelH * 0.5);
        const gx = Math.floor(px / cellSize);
        const gy = Math.floor(py / cellSize);
        if (!Number.isFinite(gx) || !Number.isFinite(gy)) return null;
        if (gx < 0 || gx >= gridW || gy < 0 || gy >= gridH) return null;
        return { gx, gy };
    }

    private gridToWorld(gx: number, gy: number): { x: number; y: number } | null {
        if (!this.grid) return null;
        const { cellSize, gridW, gridH, levelW, levelH, legacyTopLeft } = this.grid;
        if (gx < 0 || gx >= gridW || gy < 0 || gy >= gridH) return null;
        const px = (gx + 0.5) * cellSize;
        const py = (gy + 0.5) * cellSize;
        const x = px - levelW * 0.5;
        const y = legacyTopLeft ? (levelH * 0.5 - py) : (py - levelH * 0.5);
        return { x, y };
    }

    private findNearestWalkableIndex(idx: number): number {
        if (!this.grid || !this.walkableMask) return -1;
        const { gridW, gridH } = this.grid;
        const n = gridW * gridH;
        if (idx >= 0 && idx < n && this.walkableMask[idx] === 1) return idx;
        if (idx < 0 || idx >= n) return -1;

        const sx = idx % gridW;
        const sy = (idx / gridW) | 0;
        const maxR = Math.max(gridW, gridH);
        for (let r = 1; r <= maxR; r++) {
            for (let dy = -r; dy <= r; dy++) {
                const y = sy + dy;
                if (y < 0 || y >= gridH) continue;
                const dx = r - Math.abs(dy);
                const x1 = sx - dx;
                const x2 = sx + dx;
                if (x1 >= 0 && x1 < gridW) {
                    const i1 = y * gridW + x1;
                    if (this.walkableMask[i1] === 1) return i1;
                }
                if (x2 !== x1 && x2 >= 0 && x2 < gridW) {
                    const i2 = y * gridW + x2;
                    if (this.walkableMask[i2] === 1) return i2;
                }
            }
        }
        return -1;
    }

    private stepAlongFlow(entity: Entity, tr: TransformComponent): void {
        if (!this.grid || !this.walkableMask || !this.dirX || !this.dirY) return;

        const cell = this.worldToGrid(tr.x, tr.y);
        if (!cell) return;
        const idx = cell.gy * this.grid.gridW + cell.gx;
        if (this.walkableMask[idx] === 0) return;
        const dx = this.dirX[idx];
        const dy = this.dirY[idx];
        if (dx === 0 && dy === 0) return;

        const ng = this.gridToWorld(cell.gx + dx, cell.gy + dy);
        if (!ng) return;

        const move = entity.getComponent(MoveStatsComponent);
        const opts = move ? { maxSpeed: move.maxSpeed, accel: move.accel, decel: move.decel, threshold: move.threshold } : undefined;

        const current = this.actionSystem.getCurrentAction(entity);
        if (current instanceof WalkAction) {
            current.setTarget({ x: ng.x, y: ng.y });
            return;
        }

        if (!this.actionSystem.isIdle(entity)) return;
        this.actionSystem.setSingleAction(entity, new WalkAction(entity, ng, opts));
    }

    private tryAcquireBaseAsTarget(entity: Entity, tr: TransformComponent, target: TargetComponent): boolean {
        const baseId = this.getBaseEntityId();
        if (baseId === null) return false;
        const baseEnt = this.world.getEntity(baseId);
        if (!baseEnt || !baseEnt.active) return false;
        const bt = baseEnt.getComponent(TransformComponent);
        if (!bt) return false;

        const selfR = approxRadius(entity.getComponent(ColliderComponent));
        const baseR = approxRadius(baseEnt.getComponent(ColliderComponent));
        const dx = bt.x - tr.x;
        const dy = bt.y - tr.y;
        const engage = Math.max(24, selfR + baseR + 18);
        if (dx * dx + dy * dy > engage * engage) return false;

        target.targetEntityId = baseId;
        target.targetX = bt.x;
        target.targetY = bt.y;
        target.lockedUntilTime = 0;
        return true;
    }
}

function approxRadius(collider: ColliderComponent | null | undefined): number {
    if (!collider) return 0;
    if (collider.shape === ColliderShapeType.Circle) return Math.max(0, collider.radius);
    const hw = Math.max(0, collider.width) * 0.5;
    const hh = Math.max(0, collider.height) * 0.5;
    return Math.sqrt(hw * hw + hh * hh);
}

function clampInt(v: number, min: number, max: number): number {
    if (min > max) return v;
    return Math.max(min, Math.min(max, v));
}
