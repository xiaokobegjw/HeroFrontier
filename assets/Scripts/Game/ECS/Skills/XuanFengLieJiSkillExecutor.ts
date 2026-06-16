import { SkillExecuteContext, SkillExecutor } from './SkillExecutor';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { XuanFengLieJiComponent } from '../Components/XuanFengLieJiComponent';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ViewComponent } from '../Components/ViewComponent';

export class XuanFengLieJiSkillExecutor implements SkillExecutor {
    public readonly id: string = 'Hero_XuanFengLieJi';

    execute(ctx: SkillExecuteContext): void {
        const caster = ctx.caster;
        if (!caster) return;

        let component = caster.getComponent(XuanFengLieJiComponent);
        if (!component) {
            component = new XuanFengLieJiComponent(caster);
            caster.addComponent(component);
        }

        const cfgAny = ctx.levelConfig as any;
        component.updateFromConfig(cfgAny);
        
        // 检查prefab路径
        if (cfgAny.prefabPath) {
            component.prefabPath = cfgAny.prefabPath;
        }

        const transform = caster.getComponent(TransformComponent);
        if (!transform) return;

        // 获取目标位置
        let targetX: number, targetY: number;
        if (!Number.isNaN(ctx.targetX) && !Number.isNaN(ctx.targetY)) {
            // 使用指定目标位置
            targetX = ctx.targetX;
            targetY = ctx.targetY;
        } else {
            // 随机方向
            const angle = Math.random() * Math.PI * 2;
            const distance = 200; // 龙卷风发射距离
            targetX = transform.x + Math.cos(angle) * distance;
            targetY = transform.y + Math.sin(angle) * distance;
        }

        // 创建龙卷风
        for (let i = 0; i < component.tornadoCount; i++) {
            this.createTornado(ctx.world, caster, transform.x, transform.y, targetX, targetY, component, i);
        }
    }

    private createTornado(world: any, caster: Entity, startX: number, startY: number, targetX: number, targetY: number, component: XuanFengLieJiComponent, index: number): void {
        const tornadoEntity = world.createEntity();

        // 计算分散角度，多个龙卷风时散开
        const spreadAngle = (index - (component.tornadoCount - 1) / 2) * 0.3; // 分散17度左右

        // 计算方向
        let dx = targetX - startX;
        let dy = targetY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 5) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
        }
        
        // 应用分散角度
        const angle = Math.atan2(dy, dx) + spreadAngle;
        const speed = 50; // 龙卷风移动速度
        
        // 添加TransformComponent
        const transform = world.acquireComponent(TransformComponent);
        transform.x = startX;
        transform.y = startY;
        transform.scaleX = component.radius / 60; // 根据配置半径缩放，原始特效半径60像素
        transform.scaleY = component.radius / 60;
        tornadoEntity.addComponent(transform);

        // 添加ViewComponent
        const view = world.acquireComponent(ViewComponent);
        view.prefabPath = component.prefabPath;
        tornadoEntity.addComponent(view);

        // 存储龙卷风数据
        (tornadoEntity as any).tornadoData = {
            casterId: caster.id,
            radius: component.radius,
            duration: component.duration,
            damagePerSecondPct: component.damagePerSecondPct,
            speedX: Math.cos(angle) * speed,
            speedY: Math.sin(angle) * speed,
            rotationSpeed: 2 * Math.PI, // 每秒转一圈
            elapsedTime: 0,
            lastDamageTime: 0,
            damagedEntities: new Set<number>() // 用于记录已伤害的实体，防止瞬间溢出
        };
    }

    update(_deltaTime: number, _entity: Entity): void {
        // 主动技能，更新逻辑在系统中处理
    }

    cancel(_entity: Entity): void {
        // 主动技能无需特殊取消
    }
}