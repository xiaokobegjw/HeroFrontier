import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { SkillExecuteContext, SkillExecutor } from './SkillExecutor';
import { ArrowRainComponent } from '../Components/ArrowRainComponent';

export class SkyfallArrowSkillExecutor implements SkillExecutor {
    public readonly id: string = 'Hero_SkyfallArrow';

    execute(ctx: SkillExecuteContext): void {
        const casterTr = ctx.caster.getComponent(TransformComponent);
        if (!casterTr) return;

        const levelCfgAny = ctx.levelConfig as any;
        const arrowsPerWave = Math.max(0, Math.floor(levelCfgAny?.arrowsPerWave ?? 0));
        const waveCount = Math.max(0, Math.floor(levelCfgAny?.waveCount ?? 0));
        const durationSeconds = Math.max(0.05, Number(levelCfgAny?.durationSeconds ?? 0.05));
        const damageCoeffPerArrow = Math.max(0, Number(levelCfgAny?.damageCoeffPerArrow ?? 0));
        const pierceTargets = Math.max(0, Math.floor(levelCfgAny?.pierceTargets ?? 0));
        const radius = Math.max(0, Number(levelCfgAny?.radius ?? 240));
        const prefabPath = String(levelCfgAny?.prefabPath ?? '');

        const spawner = ctx.world.createEntity(`Effect_SkyfallArrowRain_${ctx.caster.id}_${Date.now()}`);
        const tr = ctx.world.acquireComponent(TransformComponent);
        tr.x = casterTr.x;
        tr.y = casterTr.y;
        tr.rotation = 0;
        spawner.addComponent(tr);

        const rain = ctx.world.acquireComponent(ArrowRainComponent);
        rain.ownerId = ctx.caster.id;
        rain.damageCoeffPerArrow = damageCoeffPerArrow;
        rain.arrowsPerWave = arrowsPerWave;
        rain.waveCount = waveCount;
        rain.durationSeconds = durationSeconds;
        rain.timeRemaining = durationSeconds;
        rain.radius = radius;
        rain.pierceTargets = pierceTargets;
        rain.prefabPath = prefabPath;
        rain.arrowSpeed = Math.max(1, Number(levelCfgAny?.arrowSpeed ?? 900));
        rain.spawnExtraHeight = Math.max(0, Number(levelCfgAny?.spawnExtraHeight ?? 90));
        rain.colliderRadius = Math.max(1, Number(levelCfgAny?.colliderRadius ?? 12));
        rain.stickSeconds = Math.max(0, Number(levelCfgAny?.stickSeconds ?? 0.6));
        rain.waveInterval = waveCount > 0 ? durationSeconds / waveCount : durationSeconds;
        rain.nextWaveIn = 0;
        rain.arrowSpawnRemaining = 0;
        rain.nextArrowIn = 0;
        spawner.addComponent(rain);
    }
}
