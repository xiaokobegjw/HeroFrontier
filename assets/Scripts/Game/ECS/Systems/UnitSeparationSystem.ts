import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { SpatialIndexSystem } from './SpatialIndexSystem';
import { HealthComponent } from '../Components/HealthComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { FactionType } from '../../Data/Faction';

type Body = {
    entity: Entity;
    x: number;
    y: number;
    r: number;
    faction: FactionType;
    // 存储需要应用的位移（延迟更新）
    dx: number;
    dy: number;
};

/**
 * 单位间简单分离：友军/敌军互不重叠，避免挤成一团。
 */
export class UnitSeparationSystem extends ECSSystem {
    private world: World;
    private queryPadding: number = 48;
    private maxPushPerFrame: number = 8;  // 每帧最大推挤距离，防止过度修正
    private separationStrength: number = 1.0;  // 分离强度系数

    constructor(world: World, priority: number = 4.86) {
        super('UnitSeparationSystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, ColliderComponent, HealthComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        const spatial = this.world.getSystem(SpatialIndexSystem);
        if (!spatial) return;

        const bodies: Body[] = [];
        // 收集所有活跃单位的信息（延迟更新模式）
        for (const e of entities) {
            const hp = e.getComponent(HealthComponent);
            if (!hp || hp.isDead) continue;
            const tr = e.getComponent(TransformComponent);
            const col = e.getComponent(ColliderComponent);
            const fac = e.getComponent(FactionComponent);
            if (!tr || !col || col.shape !== ColliderShapeType.Circle) continue;
            bodies.push({
                entity: e,
                x: tr.x + col.offsetX,
                y: tr.y + col.offsetY,
                r: col.radius,
                faction: fac?.faction ?? FactionType.Neutral,
                dx: 0,  // 初始化位移为0
                dy: 0
            });
        }

        // 计算分离力（使用初始位置，不立即更新）
        for (let i = 0; i < bodies.length; i++) {
            const a = bodies[i];
            const range = {
                x: a.x - a.r - this.queryPadding,
                y: a.y - a.r - this.queryPadding,
                width: (a.r + this.queryPadding) * 2,
                height: (a.r + this.queryPadding) * 2
            };

            const neighborIds = [
                ...spatial.queryFaction(FactionType.Player, range),
                ...spatial.queryFaction(FactionType.Enemy, range),
                ...spatial.queryFaction(FactionType.Neutral, range)
            ];

            let pushX = 0;
            let pushY = 0;

            for (const id of neighborIds) {
                // 跳过自己
                if (id === a.entity.id) continue;

                // 找到邻居实体对应的 body
                let b: Body | undefined;
                for (let j = 0; j < bodies.length; j++) {
                    if (bodies[j].entity.id === id) {
                        b = bodies[j];
                        break;
                    }
                }
                if (!b) continue;

                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const distSq = dx * dx + dy * dy;
                const minDist = a.r + b.r + 2;
                const minDistSq = minDist * minDist;
                
                // 没有重叠则跳过
                if (distSq >= minDistSq) continue;

                // 计算分离方向和力度
                const dist = Math.sqrt(Math.max(1e-6, distSq));
                const nx = dist > 1e-4 ? dx / dist : (Math.random() - 0.5) * 2;  // 避免除零，随机方向
                const ny = dist > 1e-4 ? dy / dist : (Math.random() - 0.5) * 2;
                const overlap = minDist - dist;
                
                // 同阵营分离力度更大
                const sameFaction = a.faction === b.faction;
                const strength = sameFaction ? 1 : 0.65;
                
                // 累积推挤力
                pushX += nx * overlap * strength;
                pushY += ny * overlap * strength;
            }

            // 存储位移（延迟应用）
            a.dx = pushX;
            a.dy = pushY;
        }

        // 统一应用位移（使用 deltaTime 缩放和最大限制）
        const dtFactor = Math.min(deltaTime * 60, 1);  // 基于帧率的缩放因子
        for (const body of bodies) {
            // 应用 deltaTime 缩放
            let finalDx = body.dx * this.separationStrength * dtFactor;
            let finalDy = body.dy * this.separationStrength * dtFactor;

            // 限制最大推挤距离，防止震荡
            const pushMagnitude = Math.sqrt(finalDx * finalDx + finalDy * finalDy);
            if (pushMagnitude > this.maxPushPerFrame) {
                const scale = this.maxPushPerFrame / pushMagnitude;
                finalDx *= scale;
                finalDy *= scale;
            }

            // 应用到位移组件
            const tr = body.entity.getComponent(TransformComponent);
            if (tr) {
                tr.x += finalDx;
                tr.y += finalDy;
            }
        }
    }
}
