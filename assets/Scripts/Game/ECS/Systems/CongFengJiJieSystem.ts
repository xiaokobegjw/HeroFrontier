import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { World } from '../../../Shared/ECS/Core/World';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { MoveSpeedModifierComponent } from '../../../Shared/ECS/Components/MoveSpeedModifierComponent';
import { WeaponComponent } from '../Components/WeaponComponent';
import { WeaponStateComponent } from '../Components/WeaponStateComponent';
import { drainKillEvents, KillEvent } from '../GameEvents';
import { FactionComponent } from '../Components/FactionComponent';

/**
 * 冲锋集结系统：处理Buff的持续时间和属性加成
 * 包括移速、攻速、伤害加成，以及击杀增益联动效果
 */
export class CongFengJiJieSystem extends ECSSystem {
    private world: World;

    constructor(world: World, priority: number = 6.5) {
        super('CongFengJiJieSystem', priority);
        this.world = world;
    }

    onStart(): void {
        // 初始化
    }

    update(_entities: Entity[], deltaTime: number): void {
        this.updateBuffData(deltaTime);
        this.updateEffects(deltaTime);
        this.processKillEvents();
    }

    /**
     * 更新所有具有冲锋集结Buff数据的士兵
     */
    private updateBuffData(deltaTime: number): void {
        const allEntities = this.world.getAllEntities();

        for (const entity of allEntities) {
            const buffData = (entity as any).congFengJiJieBuffData;
            if (!buffData || !buffData.active) continue;

            buffData.remainingTime -= deltaTime;

            // 击杀增益倒计时
            if (buffData.killBonusActive && buffData.killBonusRemainingTime > 0) {
                buffData.killBonusRemainingTime -= deltaTime;
                if (buffData.killBonusRemainingTime <= 0) {
                    buffData.killBonusActive = false;
                }
            }

            if (buffData.remainingTime <= 0) {
                // Buff过期，清理数据和移除属性加成
                this.removeBuff(entity);
                continue;
            }

            // 应用属性加成
            this.applyBuffAttributes(entity, buffData);
        }
    }

    /**
     * 应用Buff属性加成
     */
    private applyBuffAttributes(entity: Entity, buffData: any): void {
        // 移速加成
        let moveSpeedMod = entity.getComponent(MoveSpeedModifierComponent);
        if (!moveSpeedMod) {
            moveSpeedMod = this.world.acquireComponent(MoveSpeedModifierComponent);
            entity.addComponent(moveSpeedMod);
        }

        let totalMoveSpeedPct = buffData.moveSpeedPct;
        if (buffData.killBonusActive && buffData.killBonusMoveSpeedPct > 0) {
            totalMoveSpeedPct += buffData.killBonusMoveSpeedPct;
        }
        moveSpeedMod.multiplier = 1 + totalMoveSpeedPct;
        moveSpeedMod.remainingSeconds = buffData.remainingTime;

        // 攻速加成（通过减少攻击间隔实现）
        // 攻速加成 10% 意味着攻击间隔变为原来的 1/1.1 = 0.909
        let totalAttackSpeedPct = buffData.attackSpeedPct;
        if (buffData.killBonusActive && buffData.killBonusAttackSpeedPct > 0) {
            totalAttackSpeedPct += buffData.killBonusAttackSpeedPct;
        }

        const weapon = entity.getComponent(WeaponComponent);
        if (weapon) {
            // 记录原始攻击间隔（第一次）
            if (!buffData.originalAttackInterval) {
                buffData.originalAttackInterval = weapon.attackInterval;
            }
            const originalInterval = buffData.originalAttackInterval || 0.5;
            const speedMultiplier = 1 + totalAttackSpeedPct;
            weapon.attackInterval = originalInterval / speedMultiplier;
        }

        // 伤害加成
        let totalDamagePct = buffData.damagePct;
        if (buffData.killBonusActive && buffData.killBonusDamagePct > 0) {
            totalDamagePct += buffData.killBonusDamagePct;
        }

        if (weapon) {
            weapon.finalDamageBonusPct = totalDamagePct;
        }
    }

    /**
     * 移除Buff
     */
    private removeBuff(entity: Entity): void {
        const buffData = (entity as any).congFengJiJieBuffData;
        if (!buffData) return;

        // 恢复原始攻击间隔
        if (buffData.originalAttackInterval) {
            const weapon = entity.getComponent(WeaponComponent);
            if (weapon) {
                weapon.attackInterval = buffData.originalAttackInterval;
            }
        }

        // 清除移速加成
        const moveSpeedMod = entity.getComponent(MoveSpeedModifierComponent);
        if (moveSpeedMod) {
            moveSpeedMod.multiplier = 1;
            moveSpeedMod.remainingSeconds = 0;
        }

        // 清除伤害加成
        const weapon = entity.getComponent(WeaponComponent);
        if (weapon) {
            weapon.finalDamageBonusPct = 0;
        }

        // 清理数据
        (entity as any).congFengJiJieBuffData = null;
    }

    /**
     * 更新特效位置，跟随士兵移动
     */
    private updateEffects(deltaTime: number): void {
        const allEntities = this.world.getAllEntities();

        for (const entity of allEntities) {
            const effectData = (entity as any).congFengJiJieEffectData;
            if (!effectData || !effectData.active) continue;

            const soldier = this.world.getEntity(effectData.soldierId);
            if (!soldier || !soldier.active) {
                // 士兵已死亡，销毁特效
                this.world.destroyEntity(entity);
                continue;
            }

            const soldierTransform = soldier.getComponent(TransformComponent);
            const buffData = (soldier as any).congFengJiJieBuffData;

            // 如果Buff已过期，销毁特效
            if (!buffData || !buffData.active || buffData.remainingTime <= 0) {
                this.world.destroyEntity(entity);
                continue;
            }

            // 更新特效位置跟随士兵
            const effectTransform = entity.getComponent(TransformComponent);
            if (effectTransform && soldierTransform) {
                effectTransform.x = soldierTransform.x;
                effectTransform.y = soldierTransform.y;
            }
        }
    }

    /**
     * 处理击杀事件，触发击杀增益
     */
    private processKillEvents(): void {
        const killEvents = drainKillEvents();
        if (killEvents.length === 0) return;

        for (const killEvent of killEvents) {
            if (killEvent.killerId === null) continue;

            const killer = this.world.getEntity(killEvent.killerId);
            if (!killer) continue;

            // 检查杀手是否有冲锋集结Buff
            const killerBuffData = (killer as any).congFengJiJieBuffData;
            if (!killerBuffData || !killerBuffData.active) continue;

            // 检查是否有击杀增益配置
            if (killerBuffData.killBonusType === 'None') continue;

            // 根据击杀增益类型触发效果
            this.triggerKillBonus(killer, killerBuffData);
        }
    }

    /**
     * 触发击杀增益
     */
    private triggerKillBonus(killer: Entity, killerBuffData: any): void {
        if (killerBuffData.killBonusDuration <= 0) return;

        // 5级：击杀小幅提速
        if (killerBuffData.killBonusType === 'SpeedUp') {
            killerBuffData.killBonusActive = true;
            killerBuffData.killBonusRemainingTime = killerBuffData.killBonusDuration;
        }
        // 6级：击杀后全队1s小幅爆发增益
        else if (killerBuffData.killBonusType === 'Burst') {
            // 为所有有Buff的士兵触发增益
            const allEntities = this.world.getAllEntities();
            for (const entity of allEntities) {
                const buffData = (entity as any).congFengJiJieBuffData;
                if (!buffData || !buffData.active) continue;

                buffData.killBonusActive = true;
                buffData.killBonusRemainingTime = killerBuffData.killBonusDuration;
            }
        }
        // 4级：小幅作战士气提升（暂无具体效果）
        else if (killerBuffData.killBonusType === 'Morale') {
            // 可以在这里添加士气提升效果
        }
    }

    onDestroy(): void {
        // 清理所有Buff
        const allEntities = this.world.getAllEntities();
        for (const entity of allEntities) {
            const buffData = (entity as any).congFengJiJieBuffData;
            if (buffData && buffData.active) {
                this.removeBuff(entity);
            }
        }
    }

    getRequiredComponents(): any[] {
        return [];
    }
}