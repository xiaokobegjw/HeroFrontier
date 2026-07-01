import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { World } from '../../../Shared/ECS/Core/World';
import { BurningComponent } from '../Components/BurningComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { emitKillEvent, emitDeathViewEvent, emitDropCoinEffectEvent } from '../GameEvents';
import { FactionComponent } from '../Components/FactionComponent';
import { LootComponent } from '../Components/LootComponent';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ViewComponent } from '../Components/ViewComponent';

export class BurningSystem extends ECSSystem {
    private world: World;

    constructor(world: World, priority: number = 11.1) {
        super('BurningSystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [BurningComponent, HealthComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        const now = performance.now() / 1000;
        for (const entity of entities) {
            const burn = entity.getComponent(BurningComponent);
            const health = entity.getComponent(HealthComponent);
            if (!burn || !health || health.isDead) continue;

            burn.stackExpireTimes = burn.stackExpireTimes.filter(t => t > now);
            if (burn.stackExpireTimes.length === 0) continue;

            const maxStacks = burn.maxStacks > 0 ? burn.maxStacks : burn.stackExpireTimes.length;
            const stacks = Math.min(maxStacks, burn.stackExpireTimes.length);
            const dps = burn.damagePerSecond * stacks;
            if (dps <= 0) continue;

            health.current -= dps * deltaTime;
            if (health.current <= 0) {
                health.current = 0;
                health.isDead = true;
                this.emitDeath(burn.sourceEntityId, entity);
                this.world.destroyEntity(entity);
            }
        }
    }

    private emitDeath(killerId: number | null, victim: Entity): void {
        const faction = victim.getComponent(FactionComponent)?.faction ?? -1;
        const gold = victim.getComponent(LootComponent)?.gold ?? 0;
        const transform = victim.getComponent(TransformComponent);
        emitKillEvent({ 
            killerId, 
            victimId: victim.id, 
            victimFaction: faction, 
            gold,
            x: transform?.x ?? 0,
            y: transform?.y ?? 0
        });

        if (gold > 0 && transform) {
            emitDropCoinEffectEvent({
                x: transform.x,
                y: transform.y,
                gold
            });
        }

        const view = victim.getComponent(ViewComponent);
        if (!transform || !view?.dieClipPath) return;
        emitDeathViewEvent({
            prefabPath: view.prefabPath,
            dieClipPath: view.dieClipPath,
            dieStateName: view.dieStateName,
            x: transform.x,
            y: transform.y,
            offsetX: view.offsetX,
            offsetY: view.offsetY,
            scaleX: transform.scaleX * view.scale,
            scaleY: transform.scaleY * view.scale
        });
    }
}
