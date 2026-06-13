import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { World } from '../../../Shared/ECS/Core/World';
import { BuQuYiZhiComponent } from '../Components/BuQuYiZhiComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { DefenseComponent } from '../Components/DefenseComponent';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ViewComponent } from '../Components/ViewComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';

export class BuQuYiZhiSystem extends ECSSystem {
    private world: World;
    private checkInterval: number = 500;
    private lastCheckTime: number = 0;

    constructor(world: World, priority: number = 6.0) {
        super('BuQuYiZhiSystem', priority);
        this.world = world;
    }

    getRequiredComponents(): (new (...args: any[]) => any)[] {
        return [BuQuYiZhiComponent];
    }

    update(entities: Entity[], deltaTime: number): void {
        const now = Date.now();
        if (now - this.lastCheckTime < this.checkInterval) {
            return;
        }
        this.lastCheckTime = now;

        for (const entity of entities) {
            const component = entity.getComponent(BuQuYiZhiComponent);
            if (!component) continue;

            this.updateBuQuYiZhi(entity, component);
        }
    }

    private updateBuQuYiZhi(entity: Entity, component: BuQuYiZhiComponent): void {
        if (!entity || !entity.active) return;

        const health = entity.getComponent(HealthComponent);
        if (!health) return;

        const currentHpPct = health.current / health.max;
        const shouldActivate = currentHpPct < component.thresholdPct;

        if (shouldActivate) {
            this.activateEffect(entity, component);
        } else {
            this.deactivateEffect(entity, component);
        }
    }

    private activateEffect(entity: Entity, component: BuQuYiZhiComponent): void {
        if (!component.isActive) {
            component.isActive = true;
            component.lastHealTime = Date.now();
            this.createEffect(entity, component);
        }

        // 更新特效位置跟随英雄
        this.updateEffectPosition(entity, component);

        this.applyHealing(entity, component);
        this.applyDefenseBonus(entity, component);
        this.applySpeedBonus(entity, component);
    }

    private deactivateEffect(entity: Entity, component: BuQuYiZhiComponent): void {
        if (component.isActive) {
            component.isActive = false;
            this.removeEffect(entity, component);
            this.removeDefenseBonus(entity, component);
            this.removeSpeedBonus(entity, component);
        }
    }

    private applyHealing(entity: Entity, component: BuQuYiZhiComponent): void {
        const health = entity.getComponent(HealthComponent);
        if (!health) return;

        const now = Date.now();
        const elapsed = (now - component.lastHealTime) / 1000;

        if (elapsed >= 1.0) {
            const healAmount = health.max * component.healPerSecondPct;
            health.current = Math.min(health.max, health.current + healAmount);
            component.lastHealTime = now;
        }
    }

    private applyDefenseBonus(entity: Entity, component: BuQuYiZhiComponent): void {
        let defense = entity.getComponent(DefenseComponent);
        if (!defense) {
            return;
        }

        if (defense.defense < component.defenseBonus) {
            defense.defense = component.defenseBonus;
            defense.magicResist = component.defenseBonus;
        }
    }

    private removeDefenseBonus(entity: Entity, component: BuQuYiZhiComponent): void {
        const defense = entity.getComponent(DefenseComponent);
        if (!defense) return;

        if (defense.defense === component.defenseBonus) {
            defense.defense = 0;
            defense.magicResist = 0;
        }
    }

    private applySpeedBonus(entity: Entity, component: BuQuYiZhiComponent): void {
        // 移速加成功能暂时注释，待后续实现
        // if (component.moveSpeedBonusPct <= 0) return;
        // TODO: 实现移速加成逻辑
    }

    private removeSpeedBonus(entity: Entity, component: BuQuYiZhiComponent): void {
        // 移速加成功能暂时注释，待后续实现
        // TODO: 实现移速加成逻辑
    }

    private createEffect(entity: Entity, component: BuQuYiZhiComponent): void {
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

        component.effectEntityId = effectEntity.id;
    }

    private updateEffectPosition(entity: Entity, component: BuQuYiZhiComponent): void {
        if (component.effectEntityId === null) return;

        const transform = entity.getComponent(TransformComponent);
        if (!transform) return;

        const effectEntity = this.world.getEntity(component.effectEntityId);
        if (!effectEntity) return;

        const effectTransform = effectEntity.getComponent(TransformComponent);
        if (!effectTransform) return;

        effectTransform.x = transform.x;
        effectTransform.y = transform.y;
    }

    private removeEffect(entity: Entity, component: BuQuYiZhiComponent): void {
        if (component.effectEntityId === null) return;

        const effectEntity = this.world.getEntity(component.effectEntityId);
        if (effectEntity) {
            this.world.destroyEntity(effectEntity);
            console.log(`[BuQuYiZhi] Destroyed effect entity: ${component.effectEntityId}`);
        }
        component.effectEntityId = null;
    }
}