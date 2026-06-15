import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { World } from '../../../Shared/ECS/Core/World';
import { ZhongZhenJianTaComponent } from '../Components/ZhongZhenJianTaComponent';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ProjectileComponent } from '../Components/ProjectileComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { Prefab, instantiate, resources } from 'cc';

interface SwampRecord {
    createTime: number;
    duration: number;
    damageInterval: number;
    damagePerSecondPct: number;
    radius: number;
    hitEffect: string;
    lastDamageTime: number;
    swampNode: any;
    x: number;
    y: number;
}

export class ZhongZhenJianTaSystem extends ECSSystem {
    private world: World;
    private lastUpdateTime: number = 0;
    private updateInterval: number = 50;  // 每50ms更新一次
    private swampIdCounter: number = 0;
    // 记录所有沼泽及其创建时间
    private swampRecords: Map<number, SwampRecord> = new Map();
    // 记录每个施法者的沼泽列表
    private casterSwamps: Map<number, number[]> = new Map();

    constructor(world: World, priority: number = 6.2) {
        super('ZhongZhenJianTaSystem', priority);
        this.world = world;
    }

    getRequiredComponents(): (new (...args: any[]) => any)[] {
        return [ZhongZhenJianTaComponent];
    }

    update(_entities: Entity[], _deltaTime: number): void {
        const now = Date.now();
        if (now - this.lastUpdateTime < this.updateInterval) {
            return;
        }
        this.lastUpdateTime = now;

        // 检查子弹是否落地
        this.checkBulletsLanding();
        
        // 更新沼泽效果
        this.updateSwamps();
    }

    private checkBulletsLanding(): void {
        const allEntities = this.world.getAllEntities();
        
        for (const entity of allEntities) {
            const projectile = entity.getComponent(ProjectileComponent);
            if (!projectile || !projectile.isParabola) continue;
            
            // 检查是否有沼泽数据
            const swampData = (entity as any).swampData;
            if (!swampData) continue;
            
            const transform = entity.getComponent(TransformComponent);
            if (!transform) continue;
            
            // 检查是否落地，或者飞行距离足够，或者生命值即将耗尽
            const shouldLand = projectile.landed || 
                               (projectile.maxFlightDistance > 0 && projectile.currentFlightDistance >= projectile.maxFlightDistance * 0.95) ||
                               (projectile.lifeRemaining > 0 && projectile.lifeRemaining <= 0.1);
            
            if (shouldLand) {
                this.createSwamp(swampData, transform.x, transform.y);
                this.world.destroyEntity(entity);
            }
        }
    }

    private createSwamp(swampData: any, x: number, y: number): void {
        const casterId = swampData.casterId;
        const maxSwampCount = swampData.maxSwampCount;
        
        // 检查是否超过最大沼泽数量
        let casterSwampList = this.casterSwamps.get(casterId) || [];
        
        // 如果已经达到上限，移除最旧的沼泽
        if (casterSwampList.length >= maxSwampCount) {
            const oldestSwampId = casterSwampList.shift();
            if (oldestSwampId !== undefined) {
                const oldestRecord = this.swampRecords.get(oldestSwampId);
                if (oldestRecord && oldestRecord.swampNode && oldestRecord.swampNode.isValid) {
                    oldestRecord.swampNode.destroy();
                }
                this.swampRecords.delete(oldestSwampId);
                console.log(`this.swampRecords.delete 1 ${oldestSwampId}`);
            }
        }
        
        // 生成唯一ID
        const swampId = ++this.swampIdCounter;
        
        // 先创建记录，设置占位节点为null
        const now = Date.now();
        const record: SwampRecord = {
            createTime: now,
            duration: swampData.duration * 1000,
            damageInterval: swampData.damageInterval,
            damagePerSecondPct: swampData.damagePerSecondPct,
            radius: swampData.radius,
            hitEffect: swampData.hitEffect,
            lastDamageTime: 0,
            swampNode: null,
            x: x,
            y: y
        };
        this.swampRecords.set(swampId, record);
        
        casterSwampList.push(swampId);
        this.casterSwamps.set(casterId, casterSwampList);
        
        // 保存引用避免闭包中this丢失
        const swampRecords = this.swampRecords;
        const radius = swampData.radius;
        // 在闭包外就获取gameMain
        const gameMain = (this.world as any).gameMain;
        
        // 异步加载prefab
        resources.load(swampData.swampPrefab, Prefab, (err: any, prefab: Prefab | null) => {
            // 检查是否被移除
            const currentRecord = swampRecords.get(swampId);
            if (!currentRecord) {
                return;
            }
            
            if (err || !prefab) {
                console.warn('Swamp prefab not found:', swampData.swampPrefab);
                return;
            }
            
            const node = instantiate(prefab);
            node.setPosition(x, y, 0);
            
            // 根据半径缩放
            const scale = radius / 35;
            node.setScale(scale, scale, 1);
            
            // 挂载到groundEffectRootNode
            if (gameMain?.groundEffectRootNode && gameMain.groundEffectRootNode.isValid) {
                gameMain.groundEffectRootNode.addChild(node);
            } else if (gameMain?.node && gameMain.node.isValid) {
                gameMain.node.addChild(node);
            }
            
            // 更新记录
            currentRecord.swampNode = node;
        });
    }

    private updateSwamps(): void {
        const now = Date.now();
        
        // 遍历所有沼泽
        for (const [swampId, record] of this.swampRecords) {
            // 检查节点是否有效 - 如果swampNode为null，说明prefab还在加载中，跳过不删除
            if (!record.swampNode) {
                continue;  // 正在加载中，等待下次更新
            }
            if (!record.swampNode.isValid) {
                this.swampRecords.delete(swampId);
                continue;
            }
            
            // 检查是否超过持续时间
            if (now - record.createTime > record.duration) {
                record.swampNode.destroy();
                this.swampRecords.delete(swampId);
                // 从casterSwamps中移除
                for (const [_casterId, swampList] of this.casterSwamps) {
                    const index = swampList.indexOf(swampId);
                    if (index !== -1) {
                        swampList.splice(index, 1);
                        console.log(`swampList.splice`);
                        break;
                    }
                }
                continue;
            }
            
            // 检查是否到了伤害时间
            if (now - record.lastDamageTime < record.damageInterval * 1000) {
                continue;
            }
            
            // 查找范围内的敌人
            const allEntities = this.world.getAllEntities();
            for (const enemy of allEntities) {
                const enemyTransform = enemy.getComponent(TransformComponent);
                if (!enemyTransform) continue;
                
                // 跳过非敌人实体
                if (!this.isEnemy(enemy)) continue;
                
                const dx = enemyTransform.x - record.x;
                const dy = enemyTransform.y - record.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance <= record.radius) {
                    // 对敌人造成伤害
                    this.applyDamageToEnemy(enemy, record);
                    // 减速敌人
                    this.applySlowToEnemy(enemy);
                }
            }
            
            // 更新最后伤害时间
            record.lastDamageTime = now;
        }
    }
    
    private isEnemy(entity: Entity): boolean {
        const faction = entity.getComponent(FactionComponent);
        if (!faction) return false;
        // Faction.Enemy = 1 是敌人
        return faction.faction === 1;
    }
    
    private applyDamageToEnemy(enemy: Entity, record: any): void {
        // 获取敌人属性计算伤害
        let attackPower = 100;  // 默认物攻
        const attackComp = enemy.getComponent('AttackComponent' as any) as any;
        if (attackComp) {
            attackPower = attackComp.physicalAttack || 100;
        }
        
        const damage = attackPower * record.damagePerSecondPct * record.damageInterval;
        
        // 应用伤害
        const healthComp = enemy.getComponent(HealthComponent);
        if (healthComp) {
            const current = healthComp.current;
            healthComp.current = Math.max(0, current - damage);
        }
        
        // 播放受击特效
        this.playHitEffect(enemy, record.hitEffect);
    }
    
    private applySlowToEnemy(enemy: Entity): void {
        // 添加减速效果 - 需要根据项目的减速机制实现
        // 这里假设有SpeedComponent
        const speedComp = enemy.getComponent('SpeedComponent' as any) as any;
        if (speedComp && !speedComp.slowedBySwamp) {
            speedComp.originalSpeed = speedComp.speed || speedComp.moveSpeed;
            speedComp.speed = speedComp.originalSpeed * 0.5;  // 50%减速
            speedComp.slowedBySwamp = true;
        }
    }
    
    private playHitEffect(enemy: Entity, effectPath: string): void {
        const transform = enemy.getComponent(TransformComponent);
        if (!transform) return;
        
        // 加载并创建受击特效
        resources.load(effectPath, Prefab, (err: any, prefab: Prefab | null) => {
            if (err || !prefab) return;
            
            const node = instantiate(prefab);
            node.setPosition(transform.x, transform.y, 0);
            
            // 挂载到groundEffectRootNode
            const gameMain = (this.world as any).gameMain;
            const parentNode = gameMain?.groundEffectRootNode || gameMain?.node;
            if (parentNode && parentNode.isValid) {
                parentNode.addChild(node);
            }
            
            // 0.5秒后销毁特效
            setTimeout(() => {
                if (node.isValid) {
                    node.destroy();
                }
            }, 500);
        });
    }
}
