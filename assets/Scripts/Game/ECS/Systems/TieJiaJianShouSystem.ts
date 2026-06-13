import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { World } from '../../../Shared/ECS/Core/World';
import { TieJiaJianShouComponent } from '../Components/TieJiaJianShouComponent';
import { DefenseComponent } from '../Components/DefenseComponent';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ViewComponent } from '../Components/ViewComponent';
import { ProjectileComponent } from '../Components/ProjectileComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';

export class TieJiaJianShouSystem extends ECSSystem {
    private world: World;
    private lastUpdateTime: number = 0;
    private updateInterval: number = 100;  // 每100ms更新一次

    constructor(world: World, priority: number = 6.1) {
        super('TieJiaJianShouSystem', priority);
        this.world = world;
    }

    getRequiredComponents(): (new (...args: any[]) => any)[] {
        return [TieJiaJianShouComponent];
    }

    update(entities: Entity[], deltaTime: number): void {
        const now = Date.now();
        if (now - this.lastUpdateTime < this.updateInterval) {
            return;
        }
        this.lastUpdateTime = now;

        for (const entity of entities) {
            const component = entity.getComponent(TieJiaJianShouComponent);
            if (!component) continue;

            this.updateTieJiaJianShou(entity, component);
        }
    }

    private updateTieJiaJianShou(entity: Entity, component: TieJiaJianShouComponent): void {
        if (!entity || !entity.active) return;

        // 永久生效，直接应用效果
        this.applyDefenseBonus(entity, component);
        this.updateEffectPosition(entity, component);
    }

    private applyDefenseBonus(entity: Entity, component: TieJiaJianShouComponent): void {
        let defense = entity.getComponent(DefenseComponent);
        if (!defense) return;

        // 应用防御加成
        if (defense.defense < component.defenseBonus) {
            defense.defense = component.defenseBonus;
            defense.magicResist = component.defenseBonus;
        }
    }

    private createEffect(entity: Entity, component: TieJiaJianShouComponent): void {
        if (!component.prefab || component.effectEntityId !== null) return;

        const transform = entity.getComponent(TransformComponent);
        if (!transform) return;

        const effectEntity = this.world.createEntity();
        const effectTransform = this.world.acquireComponent(TransformComponent);
        effectTransform.x = transform.x;
        effectTransform.y = transform.y;
        effectTransform.scaleX = 1;
        effectTransform.scaleY = 1;
        effectEntity.addComponent(effectTransform);

        const view = this.world.acquireComponent(ViewComponent);
        view.prefabPath = component.prefab;
        effectEntity.addComponent(view);

        // 添加ProjectileComponent确保特效永久播放并跟随英雄
        const proj = this.world.acquireComponent(ProjectileComponent);
        proj.vx = 0;
        proj.vy = 0;
        proj.lifeRemaining = -1;  // 设置为负数表示永久存在
        proj.followEntityId = entity.id;  // 让特效跟随英雄
        proj.followOffsetX = 0;
        proj.followOffsetY = 0;
        effectEntity.addComponent(proj);

        component.effectEntityId = effectEntity.id;
    }

    private updateEffectPosition(entity: Entity, component: TieJiaJianShouComponent): void {
        // 如果特效还没创建，先创建
        if (component.effectEntityId === null && component.prefab) {
            this.createEffect(entity, component);
            return;
        }

        if (component.effectEntityId === null) return;

        const transform = entity.getComponent(TransformComponent);
        if (!transform) return;

        const effectEntity = this.world.getEntity(component.effectEntityId);
        if (!effectEntity) return;

        const effectTransform = effectEntity.getComponent(TransformComponent);
        if (!effectTransform) return;

        // 特效跟随英雄位置
        effectTransform.x = transform.x;
        effectTransform.y = transform.y;
    }
}
