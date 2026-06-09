import { SkillExecutor } from './SkillExecutor';
import { SkillExecuteContext } from './SkillExecutor';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { WeaponComponent } from '../Components/WeaponComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { FactionType } from '../../Data/Faction';
import { SpatialIndexSystem } from '../Systems/SpatialIndexSystem';
import { HealthComponent } from '../Components/HealthComponent';
import { ViewComponent } from '../Components/ViewComponent';
import { ProjectileComponent } from '../Components/ProjectileComponent';
import { DamageComponent } from '../Components/DamageComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';

export class PoKongZhuiJianSkillExecutor implements SkillExecutor {
    public readonly id: string = 'Hero_PoKongZhuiJian';

    execute(ctx: SkillExecuteContext): void {
        const casterTr = ctx.caster.getComponent(TransformComponent);
        const weapon = ctx.caster.getComponent(WeaponComponent);
        if (!casterTr || !weapon) return;

        const cfgAny = ctx.levelConfig as any;
        const damageCoeff = Math.max(0, Number(cfgAny?.damageCoeff ?? 0));
        const armorPenPct = Math.max(0, Number(cfgAny?.armorPenPct ?? 0));
        const bounceCount = Math.max(0, Number(cfgAny?.bounceCount ?? 0));
        const critBonusPct = Math.max(0, Number(cfgAny?.critBonusPct ?? 0));
        const executeThreshold = Math.max(0, Number(cfgAny?.executeThreshold ?? 0));
        const prefabPath = String(cfgAny?.prefabPath ?? '');
        const level = Number(cfgAny?.level ?? 1);

        // 从配置读取全局参数
        const configAny = ctx.config as any;
        const searchRadius = Math.max(100, Number(configAny?.searchRadius ?? 800));
        const defaultSpeed = Math.max(100, Number(configAny?.defaultSpeed ?? 600));
        const homingSpeed = Math.max(100, Number(configAny?.homingSpeed ?? 300));
        const maxFlightDistance = Math.max(100, Number(configAny?.maxFlightDistance ?? 1200));
        const homingMinLevel = Math.max(1, Number(configAny?.homingMinLevel ?? 5));
        const homingFactor = Math.max(0.01, Math.min(1, Number(configAny?.homingFactor ?? 0.1)));
        const randomDirectionDist = maxFlightDistance * 0.3; // 随机方向距离为最大飞行距离的30%

        const faction = ctx.caster.getComponent(FactionComponent)?.faction ?? FactionType.Player;
        const spatial = ctx.world.getSystem(SpatialIndexSystem);

        const targetEntity = this.findTarget(ctx, spatial, faction, casterTr, searchRadius);
        
        let targetTr = targetEntity?.getComponent(TransformComponent);
        
        // 如果没有找到目标，生成一个随机方向
        if (!targetTr) {
            const angle = Math.random() * Math.PI * 2;
            targetTr = {
                x: casterTr.x + Math.cos(angle) * randomDirectionDist,
                y: casterTr.y + Math.sin(angle) * randomDirectionDist
            } as TransformComponent;
        }

        const damage = Math.max(0, weapon.damage * damageCoeff);

        this.createProjectile(ctx, casterTr, targetTr, damage, armorPenPct, bounceCount, critBonusPct, executeThreshold, faction, prefabPath, level, targetEntity?.id ?? null, defaultSpeed, homingSpeed, maxFlightDistance, homingMinLevel, homingFactor);
    }

    private findTarget(ctx: SkillExecuteContext, spatial: SpatialIndexSystem | null, faction: FactionType, casterTr: TransformComponent, searchRadius: number): any {
        if (!spatial) return null;

        const ids = spatial.queryOpponents(faction, {
            x: casterTr.x - searchRadius,
            y: casterTr.y - searchRadius,
            width: searchRadius * 2,
            height: searchRadius * 2
        });

        // 收集所有有效敌人
        const validTargets: any[] = [];
        for (const id of ids) {
            const ent = ctx.world.getEntity(id);
            const hp = ent?.getComponent(HealthComponent);
            const tr = ent?.getComponent(TransformComponent);
            if (!ent || !ent.active || !hp || hp.isDead || !tr) continue;
            validTargets.push(ent);
        }

        // 如果有敌人，随机选择一个
        if (validTargets.length > 0) {
            const randomIndex = Math.floor(Math.random() * validTargets.length);
            return validTargets[randomIndex];
        }

        return null;
    }

    private createProjectile(
        ctx: SkillExecuteContext,
        casterTr: TransformComponent,
        targetTr: TransformComponent,
        damage: number,
        armorPenPct: number,
        bounceCount: number,
        critBonusPct: number,
        executeThreshold: number,
        faction: FactionType,
        prefabPath: string,
        level: number,
        targetEntityId: number | null,
        defaultSpeed: number,
        homingSpeed: number,
        maxFlightDistance: number,
        homingMinLevel: number,
        homingFactor: number
    ): void {
        const eff = ctx.world.createEntity(`Effect_PoKongZhuiJian_${ctx.caster.id}_${Date.now()}`);

        const tr = ctx.world.acquireComponent(TransformComponent);
        tr.x = casterTr.x;
        tr.y = casterTr.y;
        tr.rotation = 0;
        eff.addComponent(tr);

        if (prefabPath) {
            const view = ctx.world.acquireComponent(ViewComponent);
            view.prefabPath = prefabPath;
            eff.addComponent(view);
        }

        const proj = ctx.world.acquireComponent(ProjectileComponent);
        const dx = targetTr.x - casterTr.x;
        const dy = targetTr.y - casterTr.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // 根据等级选择速度
        const speed = level >= homingMinLevel ? homingSpeed : defaultSpeed;
        proj.vx = (dx / dist) * speed;
        proj.vy = (dy / dist) * speed;
        proj.lifeRemaining = 10; // 延长生命周期，由飞行距离控制
        proj.damage = damage;
        proj.armorPenPct = armorPenPct;
        proj.bounceCount = bounceCount;
        proj.bounceDamageMultiplier = 0.5;
        proj.critChanceBonus = critBonusPct;
        proj.executeThreshold = executeThreshold;
        proj.executeMultiplier = 2;
        proj.ownerId = ctx.caster.id;
        
        // 高级技能具备追踪功能和穿透能力
        if (level >= homingMinLevel) {
            proj.maxFlightDistance = maxFlightDistance;
            proj.currentFlightDistance = 0;
            proj.homingFactor = homingFactor;
            // 只有当找到目标时才启用追踪
            if (targetEntityId !== null) {
                proj.homingEnabled = true;
                proj.trackTargetId = targetEntityId;
            } else {
                // 没有目标时，不启用追踪，保持当前方向飞行
                proj.homingEnabled = false;
                proj.trackTargetId = null;
            }
        } else {
            proj.maxFlightDistance = 0; // 低等级技能碰撞后消失
            proj.homingEnabled = false;
            proj.trackTargetId = null;
            proj.homingFactor = 0.1;
        }
        
        eff.addComponent(proj);

        const col = ctx.world.acquireComponent(ColliderComponent);
        col.shape = ColliderShapeType.Circle;
        col.isTrigger = true;
        col.radius = 15;
        col.offsetX = 0;
        col.offsetY = 0;
        col.layer = faction === FactionType.Player ? 4 : 8;
        col.mask = faction === FactionType.Player ? 2 : 1;
        eff.addComponent(col);

        const fac = ctx.world.acquireComponent(FactionComponent);
        fac.faction = faction;
        eff.addComponent(fac);
    }
}