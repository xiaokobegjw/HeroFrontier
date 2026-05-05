import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { ObstacleComponent } from '../Components/ObstacleComponent';

type Rect = { x: number; y: number; width: number; height: number };
type Vec2 = { x: number; y: number };

type GridPos = { gx: number; gy: number };

type OpenNode = { idx: number; f: number };

class MinHeap {
    private a: OpenNode[] = [];

    public get size(): number {
        return this.a.length;
    }

    public push(v: OpenNode): void {
        this.a.push(v);
        this.siftUp(this.a.length - 1);
    }

    public pop(): OpenNode | null {
        if (this.a.length === 0) return null;
        const top = this.a[0];
        const last = this.a.pop()!;
        if (this.a.length > 0) {
            this.a[0] = last;
            this.siftDown(0);
        }
        return top;
    }

    private siftUp(i: number): void {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.a[p].f <= this.a[i].f) break;
            const tmp = this.a[p];
            this.a[p] = this.a[i];
            this.a[i] = tmp;
            i = p;
        }
    }

    private siftDown(i: number): void {
        const n = this.a.length;
        while (true) {
            const l = i * 2 + 1;
            const r = l + 1;
            if (l >= n) break;
            let m = l;
            if (r < n && this.a[r].f < this.a[l].f) m = r;
            if (this.a[i].f <= this.a[m].f) break;
            const tmp = this.a[i];
            this.a[i] = this.a[m];
            this.a[m] = tmp;
            i = m;
        }
    }
}

export class NavigationSystem extends ECSSystem {
    private bounds: Rect;
    private cellSize: number;
    private cols: number;
    private rows: number;
    private blocked: Uint8Array;
    private baseBlocked: Uint8Array | null = null;
    private timeSinceRebuild: number = 0;
    private rebuildInterval: number = 0.2;

    constructor(bounds: Rect, cellSize: number = 40, priority: number = 6.05) {
        super('NavigationSystem', priority);
        this.bounds = bounds;
        this.cellSize = Math.max(4, cellSize);
        this.cols = Math.max(1, Math.ceil(bounds.width / this.cellSize));
        this.rows = Math.max(1, Math.ceil(bounds.height / this.cellSize));
        this.blocked = new Uint8Array(this.cols * this.rows);
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, ColliderComponent, ObstacleComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        this.timeSinceRebuild += deltaTime;
        if (this.timeSinceRebuild < this.rebuildInterval) return;
        this.timeSinceRebuild = 0;

        if (this.baseBlocked) {
            this.blocked.set(this.baseBlocked);
        } else {
            this.blocked.fill(0);
        }
        for (const e of entities) {
            const obs = e.getComponent(ObstacleComponent);
            if (!obs || !obs.blocksMovement) continue;
            const t = e.getComponent(TransformComponent);
            const c = e.getComponent(ColliderComponent);
            if (!t || !c) continue;
            this.rasterizeObstacle(t, c);
        }
    }

    public configureFromWalkableGrid(bounds: Rect, cellSize: number, cols: number, rows: number, walkableIndices: number[]): void {
        this.bounds = bounds;
        this.cellSize = Math.max(4, Math.floor(cellSize));
        this.cols = Math.max(1, Math.floor(cols));
        this.rows = Math.max(1, Math.floor(rows));
        const size = this.cols * this.rows;

        const base = new Uint8Array(size);
        base.fill(1);
        for (const idx of walkableIndices) {
            if (typeof idx !== 'number') continue;
            const i = Math.floor(idx);
            if (i >= 0 && i < size) base[i] = 0;
        }

        this.baseBlocked = base;
        this.blocked = new Uint8Array(size);
        this.blocked.set(base);
        this.timeSinceRebuild = this.rebuildInterval;
    }

    public clearBaseGrid(): void {
        this.baseBlocked = null;
        this.blocked = new Uint8Array(this.cols * this.rows);
        this.timeSinceRebuild = this.rebuildInterval;
    }

    public findPath(start: Vec2, goal: Vec2): Vec2[] {
        const startCell = this.toGrid(start.x, start.y);
        const goalCellRaw = this.toGrid(goal.x, goal.y);
        const goalCell = this.findNearestWalkable(goalCellRaw) ?? goalCellRaw;

        if (!this.inBounds(startCell) || !this.inBounds(goalCell)) return [];
        if (this.isBlocked(goalCell.gx, goalCell.gy)) return [];

        const startIdx = this.toIndex(startCell.gx, startCell.gy);
        const goalIdx = this.toIndex(goalCell.gx, goalCell.gy);
        if (startIdx === goalIdx) return [];

        const gScore = new Float32Array(this.cols * this.rows);
        const fScore = new Float32Array(this.cols * this.rows);
        const cameFrom = new Int32Array(this.cols * this.rows);
        const inOpen = new Uint8Array(this.cols * this.rows);
        const closed = new Uint8Array(this.cols * this.rows);
        for (let i = 0; i < gScore.length; i++) {
            gScore[i] = Infinity;
            fScore[i] = Infinity;
            cameFrom[i] = -1;
        }

        const heap = new MinHeap();
        gScore[startIdx] = 0;
        fScore[startIdx] = this.heuristic(startCell, goalCell);
        heap.push({ idx: startIdx, f: fScore[startIdx] });
        inOpen[startIdx] = 1;

        const neighbors = [
            { dx: 1, dy: 0, cost: 1 },
            { dx: -1, dy: 0, cost: 1 },
            { dx: 0, dy: 1, cost: 1 },
            { dx: 0, dy: -1, cost: 1 },
            { dx: 1, dy: 1, cost: 1.4142135 },
            { dx: 1, dy: -1, cost: 1.4142135 },
            { dx: -1, dy: 1, cost: 1.4142135 },
            { dx: -1, dy: -1, cost: 1.4142135 }
        ];

        while (heap.size > 0) {
            const cur = heap.pop();
            if (!cur) break;
            const currentIdx = cur.idx;
            if (closed[currentIdx]) continue;
            if (currentIdx === goalIdx) {
                return this.reconstructPath(cameFrom, startIdx, goalIdx, goal);
            }
            closed[currentIdx] = 1;

            const cx = currentIdx % this.cols;
            const cy = (currentIdx / this.cols) | 0;

            for (const n of neighbors) {
                const nx = cx + n.dx;
                const ny = cy + n.dy;
                if (!this.inBounds({ gx: nx, gy: ny })) continue;
                if (this.isBlocked(nx, ny)) continue;
                if (n.dx !== 0 && n.dy !== 0) {
                    if (this.isBlocked(cx + n.dx, cy) || this.isBlocked(cx, cy + n.dy)) continue;
                }
                const ni = this.toIndex(nx, ny);
                if (closed[ni]) continue;

                const tentative = gScore[currentIdx] + n.cost;
                if (tentative < gScore[ni]) {
                    cameFrom[ni] = currentIdx;
                    gScore[ni] = tentative;
                    const h = this.heuristic({ gx: nx, gy: ny }, goalCell);
                    fScore[ni] = tentative + h;
                    heap.push({ idx: ni, f: fScore[ni] });
                    inOpen[ni] = 1;
                } else if (!inOpen[ni]) {
                    const h = this.heuristic({ gx: nx, gy: ny }, goalCell);
                    fScore[ni] = gScore[ni] + h;
                    heap.push({ idx: ni, f: fScore[ni] });
                    inOpen[ni] = 1;
                }
            }
        }

        return [];
    }

    private reconstructPath(cameFrom: Int32Array, startIdx: number, goalIdx: number, goalWorld: Vec2): Vec2[] {
        const path: number[] = [];
        let cur = goalIdx;
        path.push(cur);
        while (cur !== startIdx) {
            cur = cameFrom[cur];
            if (cur < 0) break;
            path.push(cur);
        }
        path.reverse();

        const cells: GridPos[] = [];
        for (const idx of path) {
            const gx = idx % this.cols;
            const gy = (idx / this.cols) | 0;
            cells.push({ gx, gy });
        }

        const simplified: GridPos[] = [];
        let lastDirX = 0;
        let lastDirY = 0;
        for (let i = 0; i < cells.length; i++) {
            if (i === 0) {
                simplified.push(cells[i]);
                continue;
            }
            const dx = cells[i].gx - cells[i - 1].gx;
            const dy = cells[i].gy - cells[i - 1].gy;
            if (i === 1) {
                lastDirX = dx;
                lastDirY = dy;
                continue;
            }
            if (dx !== lastDirX || dy !== lastDirY) {
                simplified.push(cells[i - 1]);
                lastDirX = dx;
                lastDirY = dy;
            }
        }
        if (cells.length > 1) simplified.push(cells[cells.length - 1]);

        const out: Vec2[] = [];
        for (let i = 1; i < simplified.length; i++) {
            const w = this.toWorldCenter(simplified[i].gx, simplified[i].gy);
            out.push(w);
        }
        out.push({ x: goalWorld.x, y: goalWorld.y });
        return out;
    }

    private rasterizeObstacle(t: TransformComponent, c: ColliderComponent): void {
        const ox = c.offsetX ?? 0;
        const oy = c.offsetY ?? 0;
        const cx = t.x + ox;
        const cy = t.y + oy;

        const r = this.approxRadius(c);
        const min = this.toGrid(cx - r, cy - r);
        const max = this.toGrid(cx + r, cy + r);
        for (let gy = min.gy; gy <= max.gy; gy++) {
            for (let gx = min.gx; gx <= max.gx; gx++) {
                if (!this.inBounds({ gx, gy })) continue;
                const w = this.toWorldCenter(gx, gy);
                const dx = w.x - cx;
                const dy = w.y - cy;
                if (dx * dx + dy * dy <= r * r) {
                    this.blocked[this.toIndex(gx, gy)] = 1;
                }
            }
        }
    }

    private approxRadius(c: ColliderComponent): number {
        if (c.shape === ColliderShapeType.Circle) return c.radius;
        const hw = c.width * 0.5;
        const hh = c.height * 0.5;
        return Math.sqrt(hw * hw + hh * hh);
    }

    private heuristic(a: GridPos, b: GridPos): number {
        const dx = a.gx - b.gx;
        const dy = a.gy - b.gy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private toGrid(x: number, y: number): GridPos {
        const gx = Math.max(0, Math.min(this.cols - 1, Math.floor((x - this.bounds.x) / this.cellSize)));
        const gy = Math.max(0, Math.min(this.rows - 1, Math.floor((y - this.bounds.y) / this.cellSize)));
        return { gx, gy };
    }

    private toWorldCenter(gx: number, gy: number): Vec2 {
        return {
            x: this.bounds.x + (gx + 0.5) * this.cellSize,
            y: this.bounds.y + (gy + 0.5) * this.cellSize
        };
    }

    private toIndex(gx: number, gy: number): number {
        return gy * this.cols + gx;
    }

    private inBounds(p: GridPos): boolean {
        return p.gx >= 0 && p.gx < this.cols && p.gy >= 0 && p.gy < this.rows;
    }

    private isBlocked(gx: number, gy: number): boolean {
        return this.blocked[this.toIndex(gx, gy)] !== 0;
    }

    private findNearestWalkable(p: GridPos): GridPos | null {
        if (this.inBounds(p) && !this.isBlocked(p.gx, p.gy)) return p;
        const maxR = 8;
        for (let r = 1; r <= maxR; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const gx = p.gx + dx;
                    const gy = p.gy + dy;
                    if (!this.inBounds({ gx, gy })) continue;
                    if (!this.isBlocked(gx, gy)) return { gx, gy };
                }
            }
        }
        return null;
    }
}
