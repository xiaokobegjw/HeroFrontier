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
};

/**
 * 单位间简单分离：友军/敌军互不重叠，避免挤成一团。
 */
export class UnitSeparationSystem extends ECSSystem {
    private world: World;
    private queryPadding: number = 48;

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
                faction: fac?.faction ?? FactionType.Neutral
            });
        }

        for (const a of bodies) {
            const tr = a.entity.getComponent(TransformComponent)!;
            const col = a.entity.getComponent(ColliderComponent)!;
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
                if (id === a.entity.id) continue;
                const b = bodies.find(x => x.entity.id === id);
                if (!b) continue;

                const dx = a.x - b.x;
                const dy = a.y - b.y;
                const distSq = dx * dx + dy * dy;
                const minDist = a.r + b.r + 2;
                const minDistSq = minDist * minDist;
                if (distSq >= minDistSq) continue;

                const dist = Math.sqrt(Math.max(1e-6, distSq));
                const nx = dist > 1e-4 ? dx / dist : 1;
                const ny = dist > 1e-4 ? dy / dist : 0;
                const overlap = minDist - dist;
                const sameFaction = a.faction === b.faction;
                const strength = sameFaction ? 1 : 0.65;
                pushX += nx * overlap * strength;
                pushY += ny * overlap * strength;
            }

            if (pushX !== 0 || pushY !== 0) {
                tr.x += pushX;
                tr.y += pushY;
            }
        }
    }
}
