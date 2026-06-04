import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { ViewComponent } from '../Components/ViewComponent';
import { WeaponComponent } from '../Components/WeaponComponent';
import { MeleeHitboxComponent } from '../Components/MeleeHitboxComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { FactionType } from '../../Data/Faction';
import { BladeOrbitComponent } from '../Components/BladeOrbitComponent';
import { SkillExecuteContext, SkillExecutor } from './SkillExecutor';

export class BladeStormSkillExecutor implements SkillExecutor {
    public readonly id: string = 'Hero_BladeStorm';

    execute(ctx: SkillExecuteContext): void {
        const levelCfgAny = ctx.levelConfig as any;
        const ctr = ctx.caster.getComponent(TransformComponent);
        const weapon = ctx.caster.getComponent(WeaponComponent);
        if (!ctr || !weapon) return;

        const bladeCount = Math.max(1, Math.floor(levelCfgAny?.bladeCount ?? 1));
        const durationSeconds = Math.max(0.05, Number(levelCfgAny?.durationSeconds ?? 5));
        const damageCoeff = Math.max(0, Number(levelCfgAny?.damageCoeff ?? 0.8));
        const hitIntervalSeconds = Math.max(0, Number(levelCfgAny?.hitIntervalSeconds ?? 0.3));
        const orbitRadius = Math.max(0, Number(levelCfgAny?.radius ?? 60));
        const prefabPath = String(levelCfgAny?.prefabPath ?? '');
        const slowPct = Math.max(0, Number(levelCfgAny?.slowPct ?? 0));
        const slowDurationSeconds = Math.max(0, Number(levelCfgAny?.slowDurationSeconds ?? 0));
        const hitboxRadius = Math.max(10, Math.round(orbitRadius * 0.4));

        const faction = ctx.caster.getComponent(FactionComponent)?.faction ?? FactionType.Player;
        const angleStep = 360 / Math.max(1, bladeCount);

        for (let i = 0; i < bladeCount; i++) {
            const blade = ctx.world.createEntity(`Effect_BladeStorm_${ctx.caster.id}_${Date.now()}_${i}`);

            const tr = ctx.world.acquireComponent(TransformComponent);
            tr.x = ctr.x;
            tr.y = ctr.y;
            tr.rotation = 0;
            blade.addComponent(tr);

            if (prefabPath) {
                const view = ctx.world.acquireComponent(ViewComponent);
                view.prefabPath = prefabPath;
                blade.addComponent(view);
            }

            const hit = ctx.world.acquireComponent(MeleeHitboxComponent);
            hit.ownerId = ctx.caster.id;
            hit.damage = Math.max(0, weapon.damage);
            hit.damageType = 'Physical';
            hit.armorPenPct = weapon.armorPenPct;
            hit.skillMultiplier = damageCoeff;
            hit.critChance = weapon.critChance;
            hit.critMultiplier = weapon.critMultiplier;
            hit.finalDamageBonusPct = weapon.finalDamageBonusPct;
            hit.lifeRemaining = durationSeconds;
            hit.followOwner = false;
            hit.offsetX = 0;
            hit.offsetY = 0;
            hit.canHitMultiple = true;
            hit.hitIntervalSeconds = hitIntervalSeconds;
            hit.slowPct = slowPct;
            hit.slowDurationSeconds = slowDurationSeconds;
            blade.addComponent(hit);

            const factionComp = ctx.world.acquireComponent(FactionComponent);
            factionComp.faction = faction;
            blade.addComponent(factionComp);

            const col = ctx.world.acquireComponent(ColliderComponent);
            col.shape = ColliderShapeType.AABB;
            col.isTrigger = true;
            col.width = Math.max(1, hitboxRadius * 2);
            col.height = Math.max(1, hitboxRadius * 2);
            col.offsetX = 0;
            col.offsetY = 0;
            col.layer = faction === FactionType.Player ? 4 : 8;
            col.mask = faction === FactionType.Player ? 2 : 1;
            blade.addComponent(col);

            const orbit = ctx.world.acquireComponent(BladeOrbitComponent);
            orbit.ownerId = ctx.caster.id;
            orbit.radius = orbitRadius;
            orbit.angleDeg = angleStep * i;
            orbit.angularSpeedDegPerSec = -360;
            blade.addComponent(orbit);
        }
    }
}
