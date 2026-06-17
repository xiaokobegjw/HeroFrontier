import { SkillExecutor, SkillExecuteContext } from './SkillExecutor';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { FactionType } from '../../Data/Faction';
import { ViewComponent } from '../Components/ViewComponent';

/**
 * 战地驰援：瞬间为全场所有己方单位恢复生命值，并按等级附加持续回血buff
 */
export class ZhanDiChiYuanSkillExecutor implements SkillExecutor {
    public readonly id: string = 'Hero_ZhanDiChiYuan';

    execute(ctx: SkillExecuteContext): void {
        const caster = ctx.caster;
        if (!caster) return;

        const cfgAny = ctx.levelConfig as any;
        const instantHealPct = Math.max(0, Number(cfgAny?.instantHealPct ?? 0));
        const hotPct = Math.max(0, Number(cfgAny?.hotPct ?? 0));
        const hotDuration = Math.max(0, Number(cfgAny?.hotDuration ?? 0));
        const heroEffect = String(cfgAny?.heroEffect ?? '');
        const soldierEffect = String(cfgAny?.soldierEffect ?? '');

        if (instantHealPct <= 0) return;

        // 找到所有己方单位（包括英雄和士兵）
        const allies = this.findAllAllies(ctx);

        // 为每个己方单位加血并播放特效
        for (const ally of allies) {
            this.applyHeal(ally, instantHealPct);

            // 在己方单位身上记录HOT数据（持续回血）
            if (hotPct > 0 && hotDuration > 0) {
                (ally as any).zhanDiChiYuanHotData = {
                    casterId: caster.id,
                    hotPct: hotPct,
                    remainingTime: hotDuration,
                    lastHealTime: 0,
                    active: true
                };
            }

            // 播放特效（英雄和士兵用不同特效）
            const isHero = this.isHero(ally, ctx);
            const effectPath = isHero ? heroEffect : soldierEffect;
            this.createHealEffect(ctx, ally, effectPath);
        }
    }

    /**
     * 找到所有己方单位
     */
    private findAllAllies(ctx: SkillExecuteContext): Entity[] {
        const allies: Entity[] = [];
        const casterFaction = ctx.caster.getComponent(FactionComponent);
        if (!casterFaction) return allies;

        const allEntities = ctx.world.getAllEntities();
        for (const entity of allEntities) {
            if (!entity || !entity.active) continue;

            const faction = entity.getComponent(FactionComponent);
            if (!faction) continue;

            // 必须是己方（Player 阵营）
            if (faction.faction !== FactionType.Player) continue;

            // 必须有血量组件
            const health = entity.getComponent(HealthComponent);
            if (!health || health.current <= 0) continue;

            allies.push(entity);
        }

        return allies;
    }

    /**
     * 判断实体是否为英雄
     */
    private isHero(entity: Entity, ctx: SkillExecuteContext): boolean {
        return entity.id === ctx.caster.id;
    }

    /**
     * 应用瞬间回血
     */
    private applyHeal(entity: Entity, healPct: number): void {
        const health = entity.getComponent(HealthComponent);
        if (!health) return;

        const healAmount = health.max * healPct;
        health.current = Math.min(health.max, health.current + healAmount);
    }

    /**
     * 在单位身上播放回血特效
     */
    private createHealEffect(ctx: SkillExecuteContext, target: Entity, effectPath: string): void {
        if (!effectPath) return;

        const targetTransform = target.getComponent(TransformComponent);
        if (!targetTransform) return;

        const effectEntity = ctx.world.createEntity(`ZhanDiChiYuan_Effect_${Date.now()}`);

        const tr = ctx.world.acquireComponent(TransformComponent);
        tr.x = targetTransform.x;
        tr.y = targetTransform.y;
        effectEntity.addComponent(tr);

        const view = ctx.world.acquireComponent(ViewComponent);
        view.prefabPath = effectPath;
        effectEntity.addComponent(view);
    }

    update(_deltaTime: number, _entity: Entity): void {
        // 主动技能，持续效果由系统处理
    }

    cancel(_entity: Entity): void {
        // 主动技能无需特殊取消
    }
}
