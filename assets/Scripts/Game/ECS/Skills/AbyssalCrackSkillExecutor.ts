import { SkillExecuteContext, SkillExecutor } from '../SkillExecutor';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { AbyssalCrackMissileComponent } from '../Components/AbyssalCrackMissileComponent';
import { ViewComponent } from '../Components/ViewComponent';
import { SpatialIndexSystem } from '../Systems/SpatialIndexSystem';
import { FactionType } from '../../Data/Faction';
import { HealthComponent } from '../Components/HealthComponent';

export class AbyssalCrackSkillExecutor implements SkillExecutor {
    public readonly id: string = 'Hero_AbyssalCrack';
    private spatial: SpatialIndexSystem | null = null;

    execute(ctx: SkillExecuteContext): void {
        const world = ctx.world;
        if (!this.spatial) {
            this.spatial = world.getSystem(SpatialIndexSystem);
        }

        const caster = ctx.caster;
        const casterTr = caster.getComponent(TransformComponent);
        if (!casterTr) return;

        const cfgAny = ctx.levelConfig as any;
        const configAny = ctx.skillConfig as any;

        const missileCount = Math.max(1, Number(cfgAny?.missileCount ?? 1));
        const damageCoeff = Math.max(0, Number(cfgAny?.damageCoeff ?? 1.0));
        const explosionRadius = Math.max(1, Number(cfgAny?.explosionRadius ?? 20));
        const missilePrefab = String(cfgAny?.missilePrefab ?? '');
        const explosionPrefab = String(cfgAny?.explosionPrefab ?? '');
        const missileSpeed = Math.max(100, Number(configAny?.missileSpeed ?? 400));
        const parabolaHeight = Math.max(50, Number(configAny?.parabolaHeight ?? 150));

        const weapon = ctx.weapon;
        const baseDamage = weapon ? weapon.damage : 100;
        const damage = Math.floor(baseDamage * damageCoeff);

        const enemies = this.findEnemies(ctx, casterTr, 500);

        for (let i = 0; i < missileCount; i++) {
            const target = enemies[i % enemies.length];
            if (target) {
                this.createMissile(world, casterTr, target, damage, explosionRadius, missilePrefab, explosionPrefab, missileSpeed, parabolaHeight);
            }
        }
    }

    private findEnemies(ctx: SkillExecuteContext, casterTr: TransformComponent, searchRadius: number): Entity[] {
        if (!this.spatial) return [];

        const ids = this.spatial.queryOpponents(FactionType.Player, {
            x: casterTr.x - searchRadius,
            y: casterTr.y - searchRadius,
            width: searchRadius * 2,
            height: searchRadius * 2
        });

        const enemies: Entity[] = [];
        for (const id of ids) {
            const entity = ctx.world.getEntity(id);
            if (!entity || !entity.active) continue;

            const hp = entity.getComponent(HealthComponent);
            if (!hp || hp.isDead) continue;

            enemies.push(entity);
        }

        return enemies;
    }

    private createMissile(
        world: any,
        casterTr: TransformComponent,
        target: Entity,
        damage: number,
        explosionRadius: number,
        missilePrefab: string,
        explosionPrefab: string,
        missileSpeed: number,
        parabolaHeight: number
    ): void {
        const targetTr = target.getComponent(TransformComponent);
        if (!targetTr) return;

        const dx = targetTr.x - casterTr.x;
        const dy = targetTr.y - casterTr.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const flightDuration = distance / missileSpeed;

        const missileEntity = world.createEntity();
        
        const tr = new TransformComponent();
        tr.x = casterTr.x;
        tr.y = casterTr.y;
        missileEntity.addComponent(tr);

        const missile = new AbyssalCrackMissileComponent();
        missile.targetId = target.id;
        missile.damage = damage;
        missile.explosionRadius = explosionRadius;
        missile.missilePrefab = missilePrefab;
        missile.explosionPrefab = explosionPrefab;
        missile.startX = casterTr.x;
        missile.startY = casterTr.y;
        missile.targetX = targetTr.x;
        missile.targetY = targetTr.y;
        missile.parabolaHeight = parabolaHeight;
        missile.flightDuration = flightDuration;
        missile.timeElapsed = 0;
        missile.flightProgress = 0;
        missileEntity.addComponent(missile);

        if (missilePrefab) {
            const view = new ViewComponent();
            view.prefabPath = missilePrefab;
            view.parentNodeName = 'effectRootNode';
            missileEntity.addComponent(view);
        }
    }
}