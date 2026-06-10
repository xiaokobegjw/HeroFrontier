import { SkillExecutor, SkillExecuteContext } from './SkillExecutor';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { WeaponComponent } from '../Components/WeaponComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { FactionType } from '../../Data/Faction';
import { SpatialIndexSystem } from '../Systems/SpatialIndexSystem';
import { HealthComponent } from '../Components/HealthComponent';
import { DefenseComponent } from '../Components/DefenseComponent';
import { ArmorReductionComponent } from '../Components/ArmorReductionComponent';
import { ViewComponent } from '../Components/ViewComponent';
import { LevelComponent } from '../Components/LevelComponent';
import { ActionSystem } from '../../../Shared/ECS/Systems/ActionSystem';

export class SkySlashSkillExecutor implements SkillExecutor {
    public readonly id: string = 'Hero_SkySlash';

    execute(ctx: SkillExecuteContext): void {
        const casterTr = ctx.caster.getComponent(TransformComponent);
        const weapon = ctx.caster.getComponent(WeaponComponent);
        const casterFaction = ctx.caster.getComponent(FactionComponent);
        if (!casterTr || !weapon || !casterFaction) return;

        const cfgAny = ctx.levelConfig as any;
        const level = Number(cfgAny?.level ?? 1);
        const damageCoeff = Math.max(0, Number(cfgAny?.damageCoeff ?? 0));
        const armorPenPct = Math.max(0, Number(cfgAny?.armorPenPct ?? 0));
        const armorPenDuration = Math.max(0.1, Number(cfgAny?.armorPenDuration ?? 2));
        const bossBonusPct = Math.max(0, Number(cfgAny?.bossBonusPct ?? 0));
        const prefabPath = String(cfgAny?.prefabPath ?? '');
        const maxTargets = Math.max(1, Number(cfgAny?.maxTargets ?? 1));

        const configAny = ctx.config as any;
        const globalArmorPenCap = Math.max(0, Number(configAny?.globalArmorPenCap ?? 49));
        const attackRadius = Math.max(0, Number(configAny?.attackRadius ?? 250));
        const attackedEffectPath = String(configAny?.attackedEffectPath ?? '');

        const spatial = ctx.world.getSystem(SpatialIndexSystem);
        const actionSystem = ctx.world.getSystem(ActionSystem);
        if (!spatial) return;

        // 冻结英雄移动（释放技能期间不能移动）
        if (actionSystem) {
            actionSystem.clearActions(ctx.caster);
            console.log('[SkySlash] Hero movement frozen during skill cast');
        }

        // 查找范围内的多个敌人（按距离排序）
        const targets = this.findNearbyEnemies(ctx, spatial, casterFaction.faction, casterTr, attackRadius, maxTargets);
        if (targets.length === 0) {
            console.log('[SkySlash] No targets found in range');
            return;
        }

        console.log(`[SkySlash] Found ${targets.length} targets`);

        // 对每个目标造成伤害和破甲效果
        for (const targetEntity of targets) {
            const targetTr = targetEntity.getComponent(TransformComponent);
            const targetHp = targetEntity.getComponent(HealthComponent);
            const targetDefense = targetEntity.getComponent(DefenseComponent);
            const targetLevel = targetEntity.getComponent(LevelComponent);

            if (!targetTr || !targetHp) continue;

            // 计算伤害
            let damage = Math.floor(weapon.damage * damageCoeff);

            // 检查是否是BOSS（等级>=10认为是BOSS）
            const isBoss = targetLevel?.level ?? 0 >= 10;
            if (isBoss && bossBonusPct > 0) {
                damage = Math.floor(damage * (1 + bossBonusPct / 100));
                console.log(`[SkySlash] Boss bonus applied: ${bossBonusPct}%`);
            }

            // 应用破甲效果
            if (targetDefense && armorPenPct > 0) {
                let armorReduction = targetEntity.getComponent(ArmorReductionComponent);
                
                if (!armorReduction) {
                    armorReduction = ctx.world.acquireComponent(ArmorReductionComponent);
                    armorReduction.armorPenPct = armorPenPct;
                    armorReduction.durationRemaining = armorPenDuration;
                    armorReduction.sourceEntityId = ctx.caster.id;
                    targetEntity.addComponent(armorReduction);
                    console.log(`[SkySlash] Applied ${armorPenPct}% armor reduction for ${armorPenDuration}s`);
                } else {
                    const newArmorPenPct = Math.min(armorReduction.armorPenPct + armorPenPct, globalArmorPenCap);
                    armorReduction.armorPenPct = newArmorPenPct;
                    armorReduction.durationRemaining = Math.max(armorReduction.durationRemaining, armorPenDuration);
                    console.log(`[SkySlash] Stacked armor reduction to ${newArmorPenPct}% (capped at ${globalArmorPenCap}%)`);
                }
            }

            // 造成伤害
            const actualDamage = Math.max(0, damage);
            targetHp.current = Math.max(0, targetHp.current - actualDamage);
            console.log(`[SkySlash] Dealt ${actualDamage} damage to entity ${targetEntity.id}${isBoss ? ' (BOSS)' : ''}`);

            // 在敌人身上播放被击中特效
            this.createAttackedEffect(ctx, targetTr, attackedEffectPath);
        }

        // 在英雄身上播放技能特效
        this.createSlashEffect(ctx, casterTr, prefabPath, level);
    }

    private findNearbyEnemies(
        ctx: SkillExecuteContext,
        spatial: SpatialIndexSystem,
        faction: FactionType,
        casterTr: TransformComponent,
        searchRadius: number,
        maxTargets: number
    ): Entity[] {
        const ids = spatial.queryOpponents(faction, {
            x: casterTr.x - searchRadius,
            y: casterTr.y - searchRadius,
            width: searchRadius * 2,
            height: searchRadius * 2
        });

        if (ids.length === 0) return [];

        // 找到最近的敌人并按距离排序
        const enemiesWithDistance: { entity: Entity; distance: number }[] = [];

        for (const id of ids) {
            const entity = ctx.world.getEntity(id);
            if (!entity || !entity.active) continue;

            const hp = entity.getComponent(HealthComponent);
            if (!hp || hp.isDead) continue;

            const tr = entity.getComponent(TransformComponent);
            if (!tr) continue;

            const dx = tr.x - casterTr.x;
            const dy = tr.y - casterTr.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            enemiesWithDistance.push({ entity, dist });
        }

        // 按距离排序并取前maxTargets个
        enemiesWithDistance.sort((a, b) => a.dist - b.dist);
        return enemiesWithDistance.slice(0, maxTargets).map(item => item.entity);
    }

    private createSlashEffect(
        ctx: SkillExecuteContext,
        casterTr: TransformComponent,
        prefabPath: string,
        level: number
    ): void {
        if (!prefabPath) return;

        const effectEntity = ctx.world.createEntity(`SkySlash_Effect_${Date.now()}`);

        const tr = ctx.world.acquireComponent(TransformComponent);
        // 特效位置在英雄位置
        tr.x = casterTr.x;
        tr.y = casterTr.y;
        effectEntity.addComponent(tr);

        const view = ctx.world.acquireComponent(ViewComponent);
        view.prefabPath = prefabPath;
        effectEntity.addComponent(view);

        console.log(`[SkySlash] Created slash effect on hero at (${casterTr.x}, ${casterTr.y})`);
    }

    private createAttackedEffect(
        ctx: SkillExecuteContext,
        targetTr: TransformComponent,
        effectPath: string
    ): void {
        if (!effectPath) return;

        const effectEntity = ctx.world.createEntity(`SkySlash_Attacked_${Date.now()}`);

        const tr = ctx.world.acquireComponent(TransformComponent);
        tr.x = targetTr.x;
        tr.y = targetTr.y;
        effectEntity.addComponent(tr);

        const view = ctx.world.acquireComponent(ViewComponent);
        view.prefabPath = effectPath;
        effectEntity.addComponent(view);

        console.log(`[SkySlash] Created attacked effect on target at (${targetTr.x}, ${targetTr.y})`);
    }
}