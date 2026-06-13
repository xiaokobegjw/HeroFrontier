import { SkillExecuteContext, SkillExecutor } from './SkillExecutor';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { TieJiaJianShouComponent } from '../Components/TieJiaJianShouComponent';

export class TieJiaJianShouSkillExecutor implements SkillExecutor {
    public readonly id: string = 'Hero_TieJiaJianShou';

    execute(ctx: SkillExecuteContext): void {
        const caster = ctx.caster;
        if (!caster) return;

        let component = caster.getComponent(TieJiaJianShouComponent);
        if (!component) {
            component = new TieJiaJianShouComponent(caster);
            caster.addComponent(component);
        }

        const cfgAny = ctx.levelConfig as any;
        const newPrefab = String(cfgAny.prefab) || '';
        
        // 如果prefab发生变化，需要销毁旧特效
        if (component.isInitialized && component.prefab !== newPrefab && component.effectEntityId !== null) {
            const world = ctx.world;
            const oldEffectEntity = world.getEntity(component.effectEntityId);
            if (oldEffectEntity) {
                world.destroyEntity(oldEffectEntity);
            }
            component.effectEntityId = null;
        }

        // 更新配置
        component.updateFromConfig(cfgAny);
    }

    update(_deltaTime: number, _entity: Entity): void {
        // 被动技能，更新逻辑在系统中处理
    }

    cancel(_entity: Entity): void {
        // 被动技能无需取消
    }
}
