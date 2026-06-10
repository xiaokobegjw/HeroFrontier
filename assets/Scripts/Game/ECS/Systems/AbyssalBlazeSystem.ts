import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { AbyssalBlazeAuraComponent } from '../Components/AbyssalBlazeAuraComponent';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { MoveStatsComponent } from '../Components/MoveStatsComponent';
import { FactionType } from '../../Data/Faction';
import { SpatialIndexSystem } from './SpatialIndexSystem';
import { ViewComponent } from '../Components/ViewComponent';
import { BurnComponent } from '../Components/BurnComponent';

export class AbyssalBlazeSystem extends ECSSystem {
    private world: World;
    private spatial: SpatialIndexSystem | null = null;

    constructor(world: World, priority: number = 6.5) {
        super('AbyssalBlazeSystem', priority);
        this.world = world;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, AbyssalBlazeAuraComponent];
    }

    onInitialize(): void {
        // 不在初始化时获取，改为在update时懒加载
        console.log(`[AbyssalBlazeSystem] Initialized`);
    }

    public update(entities: Entity[], deltaTime: number): void {   
        // 懒加载spatial系统
        if (!this.spatial) {
            this.spatial = this.world.getSystem(SpatialIndexSystem);
            console.log(`[AbyssalBlazeSystem] spatial loaded: ${this.spatial ? 'found' : 'not found'}`);
        }
        
        if (!this.spatial) {
            console.log(`[AbyssalBlazeSystem] spatial is null, skipping update`);
            return;
        }

        for (const entity of entities) {
            const aura = entity.getComponent(AbyssalBlazeAuraComponent);
            const auraTr = entity.getComponent(TransformComponent);
            
            if (!aura || !auraTr) continue;

            // 获取施法者
            const caster = this.world.getEntity(aura.casterId);
            if (!caster || !caster.active) {
                console.log(`[AbyssalBlaze] Destroying aura ${entity.id} - caster not found or inactive`);
                entity.destroy();
                continue;
            }

            const casterTr = caster.getComponent(TransformComponent);
            const casterHp = caster.getComponent(HealthComponent);
            
            if (!casterTr) {
                console.log(`[AbyssalBlaze] Destroying aura ${entity.id} - caster has no transform`);
                entity.destroy();
                continue;
            }

            // 跟随施法者移动
            const oldX = auraTr.x;
            const oldY = auraTr.y;
            auraTr.x = casterTr.x;
            auraTr.y = casterTr.y;
            
            if (oldX !== casterTr.x || oldY !== casterTr.y) {
                console.log(`[AbyssalBlaze] Aura ${entity.id} moved from (${oldX.toFixed(1)}, ${oldY.toFixed(1)}) to (${casterTr.x.toFixed(1)}, ${casterTr.y.toFixed(1)})`);
            }

            // 更新持续时间
            aura.durationRemaining -= deltaTime;
            console.log(`[AbyssalBlaze] Aura ${entity.id} duration remaining: ${aura.durationRemaining.toFixed(2)}s`);
            if (aura.durationRemaining <= 0) {
                console.log(`[AbyssalBlaze] Destroying aura ${entity.id} - duration expired`);
                entity.destroy();
                continue;
            }

            // 更新tick
            aura.tickAccumulator += deltaTime;
            if (aura.tickAccumulator >= aura.tickInterval) {
                aura.tickAccumulator -= aura.tickInterval;

                // 查询范围内的敌人
                const ids = this.spatial.queryOpponents(
                    FactionType.Player,
                    {
                        x: auraTr.x - aura.radius,
                        y: auraTr.y - aura.radius,
                        width: aura.radius * 2,
                        height: aura.radius * 2
                    }
                );

                for (const id of ids) {
                    const target = this.world.getEntity(id);
                    if (!target || !target.active) continue;

                    const targetTr = target.getComponent(TransformComponent);
                    const targetHp = target.getComponent(HealthComponent);
                    const targetMove = target.getComponent(MoveStatsComponent);

                    if (!targetTr || !targetHp || targetHp.isDead) continue;

                    // 精确距离检查
                    const dx = targetTr.x - auraTr.x;
                    const dy = targetTr.y - auraTr.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist > aura.radius) continue;

                    // 造成伤害
                    const damage = Math.floor(aura.damagePerTick);
                    if (damage > 0) {
                        targetHp.currentHealth = Math.max(0, targetHp.currentHealth - damage);
                        
                        // 吸血效果
                        if (aura.lifestealPct > 0 && casterHp) {
                            const lifesteal = Math.floor(damage * (aura.lifestealPct / 100));
                            casterHp.currentHealth = Math.min(casterHp.maxHealth, casterHp.currentHealth + lifesteal);
                        }
                    }

                    // 减速效果
                    if (aura.slowPct > 0 && targetMove) {
                        targetMove.slowPct = Math.max(targetMove.slowPct, aura.slowPct);
                    }

                    // 添加着火特效（只在首次进入时添加）
                    if (aura.firePrefabPath && !aura.burnedEntities.has(id)) {
                        this.createFireEffect(targetTr, target, aura.firePrefabPath, aura.fireScale);
                        aura.burnedEntities.add(id);
                    }
                }

                // 清理已死亡的实体记录
                for (const burnedId of aura.burnedEntities) {
                    const ent = this.world.getEntity(burnedId);
                    if (!ent || !ent.active || ent.getComponent(HealthComponent)?.isDead) {
                        aura.burnedEntities.delete(burnedId);
                    }
                }
            }
        }
    }

    private createFireEffect(
        targetTr: TransformComponent,
        target: Entity,
        firePrefabPath: string,
        fireScale: number
    ): void {
        const fireEntity = this.world.createEntity(`AbyssalBlaze_Fire_${target.id}_${Date.now()}`);

        const tr = this.world.acquireComponent(TransformComponent);
        tr.x = targetTr.x;
        tr.y = targetTr.y;
        tr.scaleX = fireScale;
        tr.scaleY = fireScale;
        fireEntity.addComponent(tr);

        const view = this.world.acquireComponent(ViewComponent);
        view.prefabPath = firePrefabPath;
        fireEntity.addComponent(view);

        // 创建燃烧组件，用于追踪目标
        const burn = this.world.acquireComponent(BurnComponent);
        burn.targetId = target.id;
        burn.duration = 2; // 燃烧持续2秒
        fireEntity.addComponent(burn);

        console.log(`[AbyssalBlaze] Created fire effect on entity ${target.id} with scale ${fireScale}`);
    }
}