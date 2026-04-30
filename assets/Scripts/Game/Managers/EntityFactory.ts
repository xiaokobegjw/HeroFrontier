import { World } from '../../Shared/ECS/Core/World';
import { Entity } from '../../Shared/ECS/Core/Entity';
import { TransformComponent } from '../../Shared/ECS/Components/TransformComponent';
import { RenderComponent } from '../../Shared/ECS/Components/RenderComponent';
import { ColliderComponent, ColliderShapeType } from '../../Shared/ECS/Components/ColliderComponent';
import { FactionComponent } from '../ECS/Components/FactionComponent';
import { HealthComponent } from '../ECS/Components/HealthComponent';
import { MemoryComponent } from '../ECS/Components/MemoryComponent';
import { PerceptionComponent } from '../ECS/Components/PerceptionComponent';
import { FactionType } from '../Data/Faction';

export class EntityFactory {
    /**
     * 根据 JSON 配置创建实体
     * @param world ECS 世界
     * @param config 实体配置数据
     * @param initialState 初始状态 (如初始位置)
     */
    public static createEntityFromConfig(world: World, config: any, initialState?: { x?: number, y?: number }): Entity {
        const entity = world.createEntity(config.name || config.id);
        
        if (config.ComponentsList && Array.isArray(config.ComponentsList)) {
            for (const compConfig of config.ComponentsList) {
                this.addComponentToEntity(world, entity, compConfig, initialState);
            }
        }
        
        return entity;
    }

    /**
     * 根据配置为实体添加组件
     */
    private static addComponentToEntity(world: World, entity: Entity, config: any, initialState?: { x?: number, y?: number }): void {
        const type = config.id;
        
        switch (type) {
            case 'FactionComponent':
                const faction = FactionType[config.faction as keyof typeof FactionType] ?? FactionType.Neutral;
                const factionComp = world.acquireComponent(FactionComponent);
                factionComp.faction = faction;
                entity.addComponent(factionComp);
                break;
                
            case 'TransformComponent':
                const transform = world.acquireComponent(TransformComponent);
                // 优先使用传入的初始状态，否则使用配置(如果有)，最后使用默认值 0
                transform.x = initialState?.x ?? config.x ?? 0;
                transform.y = initialState?.y ?? config.y ?? 0;
                transform.rotation = config.rotation ?? 0;
                transform.scaleX = config.scaleX ?? 1;
                transform.scaleY = config.scaleY ?? 1;
                entity.addComponent(transform);
                break;
                
            case 'HealthComponent':
                const maxHealth = config.max ?? 100;
                const healthComp = world.acquireComponent(HealthComponent);
                healthComp.max = maxHealth;
                healthComp.current = maxHealth;
                healthComp.isDead = false;
                entity.addComponent(healthComp);
                break;
                
            case 'RenderComponent':
                const render = world.acquireComponent(RenderComponent);
                if (config.offset) {
                    render.offset.x = config.offset.x ?? 0;
                    render.offset.y = config.offset.y ?? 0;
                }
                if (config.shapes && Array.isArray(config.shapes)) {
                    render.shapes = [...config.shapes];
                }
                entity.addComponent(render);
                break;

            case 'ColliderComponent':
                const collider = world.acquireComponent(ColliderComponent);
                collider.shape = (config.shape as ColliderShapeType) ?? ColliderShapeType.Circle;
                collider.isTrigger = config.isTrigger ?? true;
                collider.offsetX = config.offsetX ?? 0;
                collider.offsetY = config.offsetY ?? 0;
                if (collider.shape === ColliderShapeType.Circle) {
                    collider.radius = config.radius ?? collider.radius;
                } else {
                    collider.width = config.width ?? collider.width;
                    collider.height = config.height ?? collider.height;
                }
                collider.layer = config.layer ?? collider.layer;
                collider.mask = config.mask ?? collider.mask;
                entity.addComponent(collider);
                break;

            case 'PerceptionComponent':
                const perception = world.acquireComponent(PerceptionComponent);
                perception.viewRange = config.viewRange ?? perception.viewRange;
                perception.fovDeg = config.fovDeg ?? perception.fovDeg;
                perception.facingDeg = config.facingDeg ?? perception.facingDeg;
                perception.checkInterval = config.checkInterval ?? perception.checkInterval;
                entity.addComponent(perception);
                break;

            case 'MemoryComponent':
                const memory = world.acquireComponent(MemoryComponent);
                memory.memorySeconds = config.memorySeconds ?? memory.memorySeconds;
                memory.maxTargets = config.maxTargets ?? memory.maxTargets;
                entity.addComponent(memory);
                break;
                
            default:
                console.warn(`[EntityFactory] Unknown component type: ${type}`);
                break;
        }
    }
}
