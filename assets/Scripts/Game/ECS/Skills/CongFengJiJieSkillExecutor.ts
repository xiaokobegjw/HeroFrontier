import { SkillExecutor, SkillExecuteContext } from './SkillExecutor';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { FactionType } from '../../Data/Faction';
import { ViewComponent } from '../Components/ViewComponent';

/**
 * 冲锋集结：为全场士兵添加移速、攻速、伤害加成，并在脚下播放特效
 */
export class CongFengJiJieSkillExecutor implements SkillExecutor {
    public readonly id: string = 'Hero_CongFengJiJie';

    execute(ctx: SkillExecuteContext): void {
        const caster = ctx.caster;
        if (!caster) return;

        const cfgAny = ctx.levelConfig as any;
        const moveSpeedPct = Math.max(0, Number(cfgAny?.moveSpeedPct ?? 0));
        const attackSpeedPct = Math.max(0, Number(cfgAny?.attackSpeedPct ?? 0));
        const damagePct = Math.max(0, Number(cfgAny?.damagePct ?? 0));
        const duration = Math.max(0, Number(cfgAny?.duration ?? 0));
        const effectPrefab = String(cfgAny?.effectPrefab ?? '');
        const killBonusType = String(cfgAny?.killBonusType ?? 'None');
        const killBonusDuration = Math.max(0, Number(cfgAny?.killBonusDuration ?? 0));
        const killBonusMoveSpeedPct = Math.max(0, Number(cfgAny?.killBonusMoveSpeedPct ?? 0));
        const killBonusAttackSpeedPct = Math.max(0, Number(cfgAny?.killBonusAttackSpeedPct ?? 0));
        const killBonusDamagePct = Math.max(0, Number(cfgAny?.killBonusDamagePct ?? 0));

        if (duration <= 0) return;

        // 找到所有己方士兵（不包括英雄）
        const soldiers = this.findAllSoldiers(ctx);

        // 为每个士兵添加Buff数据和特效
        for (const soldier of soldiers) {
            // 记录Buff数据
            (soldier as any).congFengJiJieBuffData = {
                casterId: caster.id,
                moveSpeedPct: moveSpeedPct,
                attackSpeedPct: attackSpeedPct,
                damagePct: damagePct,
                remainingTime: duration,
                active: true,
                // 击杀增益配置
                killBonusType: killBonusType,
                killBonusDuration: killBonusDuration,
                killBonusMoveSpeedPct: killBonusMoveSpeedPct,
                killBonusAttackSpeedPct: killBonusAttackSpeedPct,
                killBonusDamagePct: killBonusDamagePct,
                // 击杀增益状态
                killBonusActive: false,
                killBonusRemainingTime: 0
            };

            // 在士兵脚下创建特效
            this.createSoldierEffect(ctx, soldier, effectPrefab);
        }
    }

    /**
     * 找到所有己方士兵（不包括英雄）
     */
    private findAllSoldiers(ctx: SkillExecuteContext): Entity[] {
        const soldiers: Entity[] = [];
        const casterFaction = ctx.caster.getComponent(FactionComponent);
        if (!casterFaction) return soldiers;

        const allEntities = ctx.world.getAllEntities();
        for (const entity of allEntities) {
            if (!entity || !entity.active) continue;

            // 排除英雄
            if (entity.id === ctx.caster.id) continue;

            const faction = entity.getComponent(FactionComponent);
            if (!faction) continue;

            // 必须是己方（Player 阵营）
            if (faction.faction !== FactionType.Player) continue;

            // 必须有血量组件
            const health = entity.getComponent(HealthComponent);
            if (!health || health.current <= 0) continue;

            soldiers.push(entity);
        }

        return soldiers;
    }

    /**
     * 在士兵脚下创建特效
     */
    private createSoldierEffect(ctx: SkillExecuteContext, soldier: Entity, effectPath: string): void {
        if (!effectPath) return;

        const soldierTransform = soldier.getComponent(TransformComponent);
        if (!soldierTransform) return;

        const effectEntity = ctx.world.createEntity(`CongFengJiJie_Effect_${Date.now()}_${soldier.id}`);

        const tr = ctx.world.acquireComponent(TransformComponent);
        tr.x = soldierTransform.x;
        tr.y = soldierTransform.y;
        effectEntity.addComponent(tr);

        const view = ctx.world.acquireComponent(ViewComponent);
        view.prefabPath = effectPath;
        effectEntity.addComponent(view);

        // 记录特效所属的士兵ID，用于跟随移动
        (effectEntity as any).congFengJiJieEffectData = {
            soldierId: soldier.id,
            active: true
        };
    }

    update(_deltaTime: number, _entity: Entity): void {
        // 主动技能，持续效果由系统处理
    }

    cancel(_entity: Entity): void {
        // 主动技能无需特殊取消
    }
}