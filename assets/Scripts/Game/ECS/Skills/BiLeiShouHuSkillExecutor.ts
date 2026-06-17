import { SkillExecutor, SkillExecuteContext } from './SkillExecutor';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { FactionType } from '../../Data/Faction';
import { ViewComponent } from '../Components/ViewComponent';

/**
 * 壁垒守护：为全场己方单位提供全额伤害减免
 */
export class BiLeiShouHuSkillExecutor implements SkillExecutor {
    public readonly id: string = 'Hero_BiLeiShouHu';

    execute(ctx: SkillExecuteContext): void {
        const caster = ctx.caster;
        if (!caster) return;

        const cfgAny = ctx.levelConfig as any;
        const damageReductionPct = Math.max(0, Number(cfgAny?.damageReductionPct ?? 0));
        const duration = Math.max(0, Number(cfgAny?.duration ?? 0));
        const heroEffect = String(cfgAny?.heroEffect ?? '');
        const allyEffect = String(cfgAny?.allyEffect ?? '');
        const extraEffectType = String(cfgAny?.extraEffectType ?? 'None');
        const dotReductionPct = Math.max(0, Number(cfgAny?.dotReductionPct ?? 0));
        const statusResistPct = Math.max(0, Number(cfgAny?.statusResistPct ?? 0));

        if (duration <= 0) return;

        // 为英雄播放特效
        this.createHeroEffect(ctx, caster, heroEffect);

        // 找到所有己方单位（包括英雄和士兵）
        const allies = this.findAllAllies(ctx);

        // 为每个己方单位添加Buff数据和特效
        for (const ally of allies) {
            // 记录Buff数据
            (ally as any).biLeiShouHuBuffData = {
                casterId: caster.id,
                damageReductionPct: damageReductionPct,
                remainingTime: duration,
                active: true,
                // 额外效果配置
                extraEffectType: extraEffectType,
                dotReductionPct: dotReductionPct,
                statusResistPct: statusResistPct
            };

            // 在单位身上播放特效
            this.createAllyEffect(ctx, ally, allyEffect);
        }
    }

    /**
     * 找到所有己方单位（包括英雄和士兵）
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
     * 为英雄播放特效
     */
    private createHeroEffect(ctx: SkillExecuteContext, hero: Entity, effectPath: string): void {
        if (!effectPath) return;

        const heroTransform = hero.getComponent(TransformComponent);
        if (!heroTransform) return;

        const effectEntity = ctx.world.createEntity(`BiLeiShouHu_HeroEffect_${Date.now()}`);

        const tr = ctx.world.acquireComponent(TransformComponent);
        tr.x = heroTransform.x;
        tr.y = heroTransform.y;
        effectEntity.addComponent(tr);

        const view = ctx.world.acquireComponent(ViewComponent);
        view.prefabPath = effectPath;
        effectEntity.addComponent(view);

        // 记录特效所属的英雄ID，用于跟随移动
        (effectEntity as any).biLeiShouHuEffectData = {
            targetId: hero.id,
            active: true
        };
    }

    /**
     * 为己方单位播放特效
     */
    private createAllyEffect(ctx: SkillExecuteContext, ally: Entity, effectPath: string): void {
        if (!effectPath) return;

        const allyTransform = ally.getComponent(TransformComponent);
        if (!allyTransform) return;

        const effectEntity = ctx.world.createEntity(`BiLeiShouHu_AllyEffect_${Date.now()}_${ally.id}`);

        const tr = ctx.world.acquireComponent(TransformComponent);
        tr.x = allyTransform.x;
        tr.y = allyTransform.y;
        effectEntity.addComponent(tr);

        const view = ctx.world.acquireComponent(ViewComponent);
        view.prefabPath = effectPath;
        effectEntity.addComponent(view);

        // 记录特效所属的单位ID，用于跟随移动
        (effectEntity as any).biLeiShouHuEffectData = {
            targetId: ally.id,
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