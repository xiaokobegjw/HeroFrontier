import { SkillExecutor, SkillExecuteContext } from './SkillExecutor';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { WeaponComponent } from '../Components/WeaponComponent';
import { ViewComponent } from '../Components/ViewComponent';
import { AbyssalBlazeAuraComponent } from '../Components/AbyssalBlazeAuraComponent';

export class AbyssalBlazeSkillExecutor implements SkillExecutor {
    public readonly id: string = 'Hero_AbyssalBlaze';

    execute(ctx: SkillExecuteContext): void {
        const casterTr = ctx.caster.getComponent(TransformComponent);
        const weapon = ctx.caster.getComponent(WeaponComponent);
        if (!casterTr || !weapon) return;

        const cfgAny = ctx.levelConfig as any;
        const level = Number(cfgAny?.level ?? 1);
        const damageCoeff = Math.max(0, Number(cfgAny?.damageCoeff ?? 0));
        const radius = Math.max(1, Number(cfgAny?.radius ?? 4));
        const slowPct = Math.max(0, Number(cfgAny?.slowPct ?? 0));
        const lifestealPct = Math.max(0, Number(cfgAny?.lifestealPct ?? 0));

        const configAny = ctx.config as any;
        const duration = Math.max(1, Number(configAny?.durationSeconds ?? 8));
        const tickInterval = Math.max(0.1, Number(configAny?.tickIntervalSeconds ?? 0.5));
        const circlePrefabPath = String(configAny?.circlePrefabPath ?? '');
        const circleBaseRadius = Number(configAny?.circleBaseRadius ?? 75);
        const firePrefabPath = String(configAny?.firePrefabPath ?? '');
        const fireScale = Number(configAny?.fireScale ?? 1.0);

        // 计算伤害（每秒）
        const damagePerSecond = Math.max(0, weapon.damage * damageCoeff);
        const damagePerTick = damagePerSecond * tickInterval;

        // 创建光环效果
        this.createAura(ctx, casterTr, ctx.caster, level, damagePerTick, radius, slowPct, lifestealPct, duration, tickInterval, circlePrefabPath, circleBaseRadius, firePrefabPath, fireScale);
    }

    private createAura(
        ctx: SkillExecuteContext,
        casterTr: TransformComponent,
        caster: Entity,
        level: number,
        damagePerTick: number,
        radius: number,
        slowPct: number,
        lifestealPct: number,
        duration: number,
        tickInterval: number,
        circlePrefabPath: string,
        circleBaseRadius: number,
        firePrefabPath: string,
        fireScale: number
    ): void {
        // 计算光圈缩放比例（radius已经是像素单位）
        const scale = radius / circleBaseRadius;

        // 创建光圈实体
        const auraEntity = ctx.world.createEntity(`AbyssalBlaze_Aura_${caster.id}_${Date.now()}`);

        const tr = ctx.world.acquireComponent(TransformComponent);
        tr.x = casterTr.x;
        tr.y = casterTr.y;
        tr.scaleX = scale;
        tr.scaleY = scale;
        auraEntity.addComponent(tr);

        if (circlePrefabPath) {
            const view = ctx.world.acquireComponent(ViewComponent);
            view.prefabPath = circlePrefabPath;
            auraEntity.addComponent(view);
        }

        // 创建光环组件
        const aura = ctx.world.acquireComponent(AbyssalBlazeAuraComponent);
        aura.casterId = caster.id;
        aura.durationRemaining = duration;
        aura.tickInterval = tickInterval;
        aura.tickAccumulator = 0;
        aura.damagePerTick = damagePerTick;
        aura.radius = radius; // 配置中已经是像素单位
        aura.slowPct = slowPct;
        aura.lifestealPct = lifestealPct;
        aura.firePrefabPath = firePrefabPath;
        aura.fireScale = fireScale;
        aura.level = level;
        auraEntity.addComponent(aura);

        console.log(`[AbyssalBlaze] Created aura at (${casterTr.x}, ${casterTr.y}), radius: ${radius}m, duration: ${duration}s`);
    }
}