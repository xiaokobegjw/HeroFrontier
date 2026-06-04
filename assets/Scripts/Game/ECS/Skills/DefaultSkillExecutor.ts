import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { RenderComponent } from '../../../Shared/ECS/Components/RenderComponent';
import { MeleeHitboxComponent } from '../Components/MeleeHitboxComponent';
import { SkillExecuteContext, SkillExecutor } from './SkillExecutor';

export class DefaultSkillExecutor implements SkillExecutor {
    public readonly id: string = '__default__';

    execute(ctx: SkillExecuteContext): void {
        const levelCfgAny = ctx.levelConfig as any;
        const power = (ctx.levelConfig && typeof levelCfgAny?.power === 'number') ? levelCfgAny.power : 0;
        if (power <= 0) return;

        let sx = ctx.targetX;
        let sy = ctx.targetY;
        if (ctx.targetEntityId !== null) {
            const te = ctx.world.getEntity(ctx.targetEntityId);
            const ttr = te?.getComponent(TransformComponent);
            if (ttr) {
                sx = ttr.x;
                sy = ttr.y;
            }
        }

        if (Number.isNaN(sx) || Number.isNaN(sy)) {
            const ctr = ctx.caster.getComponent(TransformComponent);
            sx = ctr?.x ?? 0;
            sy = ctr?.y ?? 0;
        }

        const hb = ctx.world.createEntity(`${ctx.caster.name}_skill_${ctx.configId}_${Date.now()}`);
        const tr = ctx.world.acquireComponent(TransformComponent);
        tr.x = sx;
        tr.y = sy;
        hb.addComponent(tr);

        const hit = ctx.world.acquireComponent(MeleeHitboxComponent);
        hit.ownerId = ctx.caster.id;
        hit.damage = Math.max(0, power);
        hit.armorPenPct = 0;
        hit.skillMultiplier = 1;
        hit.critChance = 0;
        hit.lifeRemaining = 0.18;
        hit.followOwner = false;
        hit.offsetX = 0;
        hit.offsetY = 0;
        hit.canHitMultiple = true;
        hb.addComponent(hit);

        try {
            const render = ctx.world.acquireComponent(RenderComponent);
            render.addCircle((levelCfgAny && (levelCfgAny.power ?? 0)) > 0 ? 24 : 12, [255, 120, 60, 180], true);
            hb.addComponent(render);
        } catch {}
    }
}

