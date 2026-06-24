import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { ReviveComponent } from '../Components/ReviveComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { SkillComponent } from '../Components/SkillComponent';
import { SkillStateComponent } from '../Components/SkillStateComponent';

export class HeroReviveSystem extends ECSSystem {
    private world: World;
    private timeSeconds: number = 0;

    constructor(world: World, priority: number = 11.05) {
        super('HeroReviveSystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => any)[] {
        return [];
    }

    public update(_entities: Entity[], deltaTime: number): void {
        this.timeSeconds += Math.max(0, deltaTime);

        for (const entity of this.world.getAllEntities()) {
            const revive = entity.getComponent(ReviveComponent);
            const health = entity.getComponent(HealthComponent);
            if (!revive || !health) continue;

            if (!health.isDead) continue;

            const elapsed = this.timeSeconds - revive.deathTime;
            const remaining = Math.max(0, revive.reviveSeconds - elapsed);

            if (remaining <= 0) {
                this.reviveHero(entity, revive, health);
            }
        }
    }

    private reviveHero(entity: Entity, revive: ReviveComponent, health: HealthComponent): void {
        health.isDead = false;
        health.current = health.max;

        const tr = entity.getComponent(TransformComponent);
        if (tr) {
            tr.x = revive.deathX;
            tr.y = revive.deathY;
        }

        entity.active = true;

        revive.deathTime = -9999;
        revive.deathX = 0;
        revive.deathY = 0;

        const skillState = entity.getComponent(SkillStateComponent);
        if (skillState) {
            const skill = entity.getComponent(SkillComponent);
            const count = skill?.skillConfigIds.length ?? 0;
            skillState.skillCooldownRemaining = new Array(count).fill(0);
        }
    }
}