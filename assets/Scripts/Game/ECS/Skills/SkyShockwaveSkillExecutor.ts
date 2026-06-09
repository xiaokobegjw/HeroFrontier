import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { SkillExecuteContext, SkillExecutor } from './SkillExecutor';
import { WeaponComponent } from '../Components/WeaponComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { FactionType } from '../../Data/Faction';
import { SpatialIndexSystem } from '../Systems/SpatialIndexSystem';
import { HealthComponent } from '../Components/HealthComponent';
import { MeleeHitboxComponent } from '../Components/MeleeHitboxComponent';
import { ViewComponent } from '../Components/ViewComponent';
import { ProjectileComponent } from '../Components/ProjectileComponent';
import { StunOnHitComponent } from '../Components/StunOnHitComponent';

export class SkyShockwaveSkillExecutor implements SkillExecutor {
    public readonly id: string = 'Hero_SkyShockwave';

    execute(ctx: SkillExecuteContext): void {
        const casterTr = ctx.caster.getComponent(TransformComponent);
        const weapon = ctx.caster.getComponent(WeaponComponent);
        if (!casterTr || !weapon) return;

        const cfgAny = ctx.levelConfig as any;
        const damageCoeff = Math.max(0, Number(cfgAny?.damageCoeff ?? 0));
        const stunSeconds = Math.max(0, Number(cfgAny?.stunSeconds ?? 0));
        const radius = Math.max(0, Number(cfgAny?.radius ?? 0));
        const prefabPath = String(cfgAny?.prefabPath ?? '');

        const faction = ctx.caster.getComponent(FactionComponent)?.faction ?? FactionType.Player;
        const spatial = ctx.world.getSystem(SpatialIndexSystem);

        let cx = casterTr.x;
        let cy = casterTr.y;

        // 如果有目标位置，优先使用目标位置
        if (!isNaN(ctx.targetX) && !isNaN(ctx.targetY)) {
            cx = ctx.targetX;
            cy = ctx.targetY;
        } else {
            // 否则搜索附近敌人
            const searchR = Math.max(120, radius * 6);
            if (spatial) {
                const ids = spatial.queryOpponents(faction, { x: casterTr.x - searchR, y: casterTr.y - searchR, width: searchR * 2, height: searchR * 2 });
                const candidates: { x: number; y: number }[] = [];
                for (const id of ids) {
                    const ent = ctx.world.getEntity(id);
                    const hp = ent?.getComponent(HealthComponent);
                    const tr = ent?.getComponent(TransformComponent);
                    if (!ent || !ent.active || !hp || hp.isDead || !tr) continue;
                    const dx = tr.x - casterTr.x;
                    const dy = tr.y - casterTr.y;
                    if (dx * dx + dy * dy > searchR * searchR) continue;
                    candidates.push({ x: tr.x, y: tr.y });
                }
                if (candidates.length > 0) {
                    const pick = candidates[(Math.random() * candidates.length) | 0];
                    cx = pick.x;
                    cy = pick.y;
                }
            }
        }

        const eff = ctx.world.createEntity(`Effect_SkyShockwave_${ctx.caster.id}_${Date.now()}`);

        const tr = ctx.world.acquireComponent(TransformComponent);
        tr.x = cx;
        tr.y = cy;
        tr.rotation = 0;
        eff.addComponent(tr);

        if (prefabPath) {
            const view = ctx.world.acquireComponent(ViewComponent);
            view.prefabPath = prefabPath;
            eff.addComponent(view);
        }

        const proj = ctx.world.acquireComponent(ProjectileComponent);
        proj.vx = 0;
        proj.vy = 0;
        proj.lifeRemaining = 5;  // 统一修改为3秒
        eff.addComponent(proj);

        const hit = ctx.world.acquireComponent(MeleeHitboxComponent);
        hit.ownerId = ctx.caster.id;
        hit.damage = Math.max(0, weapon.damage);
        hit.damageType = 'Physical';
        hit.armorPenPct = weapon.armorPenPct;
        hit.skillMultiplier = damageCoeff;
        hit.critChance = weapon.critChance;
        hit.critMultiplier = weapon.critMultiplier;
        hit.finalDamageBonusPct = weapon.finalDamageBonusPct;
        hit.lifeRemaining = 0.12;
        hit.followOwner = false;
        hit.offsetX = 0;
        hit.offsetY = 0;
        hit.canHitMultiple = true;
        eff.addComponent(hit);

        const stun = ctx.world.acquireComponent(StunOnHitComponent);
        stun.stunSeconds = stunSeconds;
        eff.addComponent(stun);

        const col = ctx.world.acquireComponent(ColliderComponent);
        col.shape = ColliderShapeType.Circle;
        col.isTrigger = true;
        col.radius = Math.max(1, radius);
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

