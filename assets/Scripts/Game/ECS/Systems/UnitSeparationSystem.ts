import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { FactionType } from '../../Data/Faction';

type Body = {
    entity: Entity;
    ox: number;
    oy: number;
    x: number;
    y: number;
    r: number;
    faction: FactionType;
    enemyContact: boolean;
};

/**
 * 单位间简单分离：友军/敌军互不重叠，避免挤成一团。
 */
export class UnitSeparationSystem extends ECSSystem {
    private world: World;
    private queryPadding: number = 48;
    private maxPushPerFrameEnemy: number = 8;
    private maxPushPerFrameFriendly: number = 5;
    private separationStrengthEnemy: number = 1.0;
    private separationStrengthFriendly: number = 0.7;
    private friendlyMinDistScale: number = 0.9;
    private cellSize: number = 64;
    private solverIterations: number = 4;

    constructor(world: World, priority: number = 4.86) {
        super('UnitSeparationSystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, ColliderComponent, HealthComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        const bodies: Body[] = [];
        for (const e of entities) {
            const hp = e.getComponent(HealthComponent);
            if (!hp || hp.isDead) continue;
            const tr = e.getComponent(TransformComponent);
            const col = e.getComponent(ColliderComponent);
            const fac = e.getComponent(FactionComponent);
            if (!tr || !col || col.shape !== ColliderShapeType.Circle) continue;
            const cx = tr.x + col.offsetX;
            const cy = tr.y + col.offsetY;
            bodies.push({
                entity: e,
                ox: cx,
                oy: cy,
                x: cx,
                y: cy,
                r: col.radius,
                faction: fac?.faction ?? FactionType.Neutral,
                enemyContact: false
            });
        }

        if (bodies.length <= 1) return;

        const dtFactor = Math.min(Math.max(0, deltaTime) * 60, 1);
        const cellSize = Math.max(16, this.cellSize);
        const iters = Math.max(1, this.solverIterations);

        for (let iter = 0; iter < iters; iter++) {
            const grid = this.buildGrid(bodies, cellSize);
            for (const a of bodies) {
                const ix = Math.floor(a.x / cellSize);
                const iy = Math.floor(a.y / cellSize);
                for (let gx = ix - 1; gx <= ix + 1; gx++) {
                    for (let gy = iy - 1; gy <= iy + 1; gy++) {
                        const list = grid.get(`${gx},${gy}`);
                        if (!list) continue;
                        for (const b of list) {
                            if (b.entity.id <= a.entity.id) continue;
                            const qx = b.x - a.x;
                            const qy = b.y - a.y;
                            const qDistSq = qx * qx + qy * qy;
                            const maxR = a.r + b.r + this.queryPadding;
                            if (qDistSq > maxR * maxR) continue;

                            const dx = a.x - b.x;
                            const dy = a.y - b.y;
                            const distSq = dx * dx + dy * dy;
                            const sameFaction = a.faction === b.faction;
                            if (sameFaction) continue;
                            const rSum = a.r + b.r;
                            const minDist = rSum + 2;
                            if (distSq >= minDist * minDist) continue;

                            let nx = 0;
                            let ny = 0;
                            const dist = Math.sqrt(Math.max(1e-8, distSq));
                            if (dist > 1e-4) {
                                nx = dx / dist;
                                ny = dy / dist;
                            } else {
                                const n = this.pairUnit(a.entity.id, b.entity.id);
                                nx = n.x;
                                ny = n.y;
                            }

                            const overlap = minDist - dist;
                            const corr = overlap * 0.5 * this.separationStrengthEnemy * dtFactor;

                            a.x += nx * corr;
                            a.y += ny * corr;
                            b.x -= nx * corr;
                            b.y -= ny * corr;

                            a.enemyContact = true;
                            b.enemyContact = true;
                        }
                    }
                }
            }
        }

        for (const body of bodies) {
            const maxPush = body.enemyContact ? this.maxPushPerFrameEnemy : this.maxPushPerFrameFriendly;
            let finalDx = body.x - body.ox;
            let finalDy = body.y - body.oy;
            const pushMagnitude = Math.sqrt(finalDx * finalDx + finalDy * finalDy);
            if (pushMagnitude > maxPush && pushMagnitude > 1e-8) {
                const scale = maxPush / pushMagnitude;
                finalDx *= scale;
                finalDy *= scale;
            }

            const tr = body.entity.getComponent(TransformComponent);
            if (tr) {
                tr.x += finalDx;
                tr.y += finalDy;
            }
        }
    }

    private buildGrid(bodies: Body[], cellSize: number): Map<string, Body[]> {
        const grid = new Map<string, Body[]>();
        for (const b of bodies) {
            const ix = Math.floor(b.x / cellSize);
            const iy = Math.floor(b.y / cellSize);
            const key = `${ix},${iy}`;
            const list = grid.get(key);
            if (list) list.push(b);
            else grid.set(key, [b]);
        }
        return grid;
    }

    private pairUnit(a: number, b: number): { x: number; y: number } {
        let x = (a * 1103515245 + b * 12345) >>> 0;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        const t = (x >>> 0) / 4294967296;
        const ang = t * Math.PI * 2;
        return { x: Math.cos(ang), y: Math.sin(ang) };
    }
}
