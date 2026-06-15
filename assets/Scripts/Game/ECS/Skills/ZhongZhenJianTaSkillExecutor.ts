import { SkillExecuteContext, SkillExecutor } from './SkillExecutor';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ZhongZhenJianTaComponent } from '../Components/ZhongZhenJianTaComponent';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ProjectileComponent } from '../Components/ProjectileComponent';
import { ViewComponent } from '../Components/ViewComponent';
import { FlowFieldNavigationSystem } from '../Systems/FlowFieldNavigationSystem';

export class ZhongZhenJianTaSkillExecutor implements SkillExecutor {
    public readonly id: string = 'Hero_ZhongZhenJianTa';

    execute(ctx: SkillExecuteContext): void {
        const caster = ctx.caster;
        if (!caster) return;

        let component = caster.getComponent(ZhongZhenJianTaComponent);
        if (!component) {
            component = new ZhongZhenJianTaComponent(caster);
            caster.addComponent(component);
        }

        const cfgAny = ctx.levelConfig as any;
        component.updateFromConfig(cfgAny);
        component.isActive = true;

        // 计算投掷方向和目标位置
        const transform = caster.getComponent(TransformComponent);
        if (!transform) return;

        // 获取目标位置：如果有指定位置则使用指定位置，否则随机选择
        let targetX: number, targetY: number;
            // 随机选择一个方向和距离
        const angle = Math.random() * Math.PI * 2;  // 0到360度随机角度
        const distance = component.throwDistance;
        targetX = transform.x + Math.cos(angle) * distance;
        targetY = transform.y + Math.sin(angle) * distance;
        

        // 使用导航系统检查目标位置是否可移动，如果不可移动则寻找最近的可移动点
        const navSystem = ctx.world.getSystem(FlowFieldNavigationSystem) as FlowFieldNavigationSystem | null;
        if (navSystem) {
            try {
                const gridPos = navSystem['worldToGrid'](targetX, targetY);
                if (gridPos) {
                    const gridW = navSystem['grid']?.gridW || 0;
                    const index = gridPos.gy * gridW + gridPos.gx;
                    const nearestIndex = navSystem['findNearestWalkableIndex'](index);
                    if (nearestIndex >= 0) {
                        const worldPos = navSystem['gridToWorld'](nearestIndex % gridW, Math.floor(nearestIndex / gridW));
                        if (worldPos) {
                            targetX = worldPos.x;
                            targetY = worldPos.y;
                        }
                    }
                }
            } catch (e) {
                // 导航系统方法调用失败，忽略
                console.warn('FlowFieldNavigationSystem method call failed:', e);
            }
        }

        // 创建妖光球
        this.createBullet(ctx.world, caster, transform.x, transform.y, targetX, targetY, component);
    }

    private createBullet(world: any, caster: Entity, startX: number, startY: number, targetX: number, targetY: number, component: ZhongZhenJianTaComponent): void {
        const bulletEntity = world.createEntity();
        
        // 添加TransformComponent
        const transform = world.acquireComponent(TransformComponent);
        transform.x = startX;
        transform.y = startY;
        transform.scaleX = 1;
        transform.scaleY = 1;
        bulletEntity.addComponent(transform);

        // 添加ViewComponent
        const view = world.acquireComponent(ViewComponent);
        view.prefabPath = component.bulletPrefab;
        bulletEntity.addComponent(view);

        // 计算抛物线初始速度
        const dx = targetX - startX;
        const dy = targetY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 如果距离为0，不发射
        if (distance < 5) return;
        
        const travelTime = 0.8;  // 飞行时间约0.8秒
        const gravity = 800;  // 重力加速度
        
        // 水平速度
        const speedX = dx / travelTime;
        // 垂直速度（需要计算使得物体在到达目标时正好落地）
        // 使用抛物线公式：y = vy*t - 0.5*g*t^2 = 0（落地时）
        // vy = 0.5 * g * t
        const speedY = 0.5 * gravity * travelTime;
        
        // 添加ProjectileComponent - 抛物线轨迹
        const projectile = world.acquireComponent(ProjectileComponent);
        projectile.vx = speedX;
        projectile.vy = speedY;
        projectile.gravity = gravity;
        projectile.lifeRemaining = 2;  // 足够飞到达目标
        projectile.maxFlightDistance = component.throwDistance;
        projectile.currentFlightDistance = 0;
        projectile.targetX = targetX;
        projectile.targetY = targetY;
        projectile.isParabola = true;
        projectile.stopY = startY;  // 落地高度为起始高度
        bulletEntity.addComponent(projectile);

        // 存储沼泽信息到bullet上
        (bulletEntity as any).swampData = {
            casterId: caster.id,
            radius: component.radius,
            duration: component.duration,
            damageInterval: component.damageInterval,
            damagePerSecondPct: component.damagePerSecondPct,
            swampPrefab: component.swampPrefab,
            hitEffect: component.hitEffect,
            maxSwampCount: component.maxSwampCount
        };
    }

    update(_deltaTime: number, _entity: Entity): void {
        // 主动技能，更新逻辑在系统中处理
    }

    cancel(_entity: Entity): void {
        // 主动技能无需特殊取消
    }
}
