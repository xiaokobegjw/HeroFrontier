import { SkillExecuteContext, SkillExecutor } from './SkillExecutor';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { BuQuYiZhiComponent } from '../Components/BuQuYiZhiComponent';

export class BuQuYiZhiSkillExecutor implements SkillExecutor {
    public readonly id: string = 'Hero_BuQuYiZhi';

    execute(ctx: SkillExecuteContext): void {
        const caster = ctx.caster;
        if (!caster) return;

        let component = caster.getComponent(BuQuYiZhiComponent);
        if (!component) {
            component = new BuQuYiZhiComponent(caster);
            caster.addComponent(component);
        }
        
        // 如果已初始化，跳过（被动技能只需初始化一次）
        if (component.isInitialized) {
            return;
        }

        const cfgAny = ctx.levelConfig as any;
        component.updateFromConfig(cfgAny);
    }

    update(_deltaTime: number, _entity: Entity): void {
        // 被动技能，更新逻辑在系统中处理
    }

    cancel(_entity: Entity): void {
        // 被动技能无需取消
    }
}