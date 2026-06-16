import { SkillExecuteContext, SkillExecutor } from './SkillExecutor';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ViewComponent } from '../Components/ViewComponent';

export class XingGuiLingZhenSkillExecutor implements SkillExecutor {
    public readonly id: string = 'Hero_XingGuiLingZhen';

    execute(ctx: SkillExecuteContext): void {
        const caster = ctx.caster;
        if (!caster) return;

        const cfgAny = ctx.levelConfig as any;
        if (!cfgAny) return;

        const transform = caster.getComponent(TransformComponent);
        if (!transform) return;

        const casterX = transform.x;
        const casterY = transform.y;

        const ballCount = cfgAny.coreBallCount || 1;
        const orbitRadius = cfgAny.orbitRadius || 40;
        const orbitSpeed = cfgAny.orbitSpeed || 3;
        const attackRange = cfgAny.attackRange || 80;
        const fireInterval = cfgAny.fireInterval || 1.5;
        const damagePerShotPct = cfgAny.damagePerShotPct || 0.4;
        const duration = cfgAny.duration || 8;
        const magicBallPrefab = cfgAny.magicBallPrefab || 'prefabs/HeroSkillXLZ';
        const bulletPrefab = cfgAny.bulletPrefab || 'prefabs/HeroSkillBallBullet';

        for (let i = 0; i < ballCount; i++) {
            this.createMagicBall(ctx.world, caster, casterX, casterY, cfgAny, i);
        }

        (caster as any).xingGuiLingZhenData = {
            casterId: caster.id,
            duration: duration,
            elapsedTime: 0,
            ballCount: ballCount,
            orbitRadius: orbitRadius,
            orbitSpeed: orbitSpeed
        };
    }

    private createMagicBall(world: any, caster: Entity, casterX: number, casterY: number, cfgAny: any, index: number): void {
        const ballEntity = world.createEntity();

        const angle = (index / cfgAny.coreBallCount) * Math.PI * 2;
        const x = casterX + Math.cos(angle) * cfgAny.orbitRadius;
        const y = casterY + Math.sin(angle) * cfgAny.orbitRadius;

        const transform = world.acquireComponent(TransformComponent);
        transform.x = x;
        transform.y = y;
        transform.scaleX = 1;
        transform.scaleY = 1;
        ballEntity.addComponent(transform);

        const view = world.acquireComponent(ViewComponent);
        view.prefabPath = cfgAny.magicBallPrefab;
        ballEntity.addComponent(view);

        (ballEntity as any).magicBallData = {
            casterId: caster.id,
            index: index,
            angle: angle,
            orbitRadius: cfgAny.orbitRadius,
            orbitSpeed: cfgAny.orbitSpeed,
            lastFireTime: 0,
            fireInterval: cfgAny.fireInterval,
            attackRange: cfgAny.attackRange,
            damagePerShotPct: cfgAny.damagePerShotPct,
            bulletPrefab: cfgAny.bulletPrefab
        };
    }
}