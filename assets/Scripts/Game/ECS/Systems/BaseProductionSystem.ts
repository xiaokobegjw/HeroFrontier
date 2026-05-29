/**
 * 城堡生产系统：负责士兵的自动生成和管理
 * 处理初始人口生成、持续生产、驻守/随从分配等功能
 */
import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { BaseProductionComponent } from '../Components/BaseProductionComponent';
import { SoldierComponent } from '../Components/SoldierComponent';
import { ObstacleComponent } from '../Components/ObstacleComponent';
import { EntityFactory } from '../../Managers/EntityFactory';
import { EntityConfigCache } from '../../Managers/EntityConfigCache';
import { garrisonSlotPosition, followerSlotPosition } from '../FormationLayout';
import { SupplySystem } from './SupplySystem';
import { ActionSystem } from '../../../Shared/ECS/Systems/ActionSystem';
import { WalkAction } from '../../../Shared/ECS/Actions/WalkAction';
import { HealthComponent } from '../Components/HealthComponent';
import { WeaponComponent } from '../Components/WeaponComponent';
import { DefenseComponent } from '../Components/DefenseComponent';
import { PlaystyleComponent } from '../Components/PlaystyleComponent';

/** 低消耗补给单位列表 */
const LOW_SUPPLY_UNITS = ['Infantry', 'Archer'];
/** 高消耗补给单位列表 */
const HIGH_SUPPLY_UNITS = ['HeavyGuard', 'Elementalist', 'RoyalKnight'];

/** V3 策划案各兵种重组 CD (秒) */
const REGROUPING_CD: Record<string, number> = {
    'Infantry': 2,
    'Archer': 3,
    'HeavyGuard': 5,
    'Elementalist': 6,
    'RoyalKnight': 8
};

/**
 * 城堡生产系统
 * 负责管理城堡的士兵生产逻辑，包括：
 * 1. 初始人口的爆发式生成
 * 2. 持续的士兵生产（受冷却时间限制）
 * 3. 驻守/随从模式的分配
 * 4. 补给消耗管理
 * 5. 士兵出场位置规划（避开障碍物）
 */
export class BaseProductionSystem extends ECSSystem {
    /** ECS世界实例 */
    private world: World;
    /** 默认士兵配置（当找不到指定配置时使用） */
    private defaultSoldierConfig: any;
    /** 获取英雄实体ID的回调函数 */
    private getHeroEntityId: () => number | null;
    /** 补给系统引用（用于消耗补给） */
    private supplySystem: SupplySystem | null = null;
    /** 动作系统引用（用于让士兵移动） */
    private actionSystem: ActionSystem | null = null;

    /**
     * 构造函数
     * @param world ECS世界实例
     * @param defaultSoldierConfig 默认士兵配置
     * @param getHeroEntityId 获取英雄实体ID的回调
     * @param priority 系统优先级（默认5.9，在物理系统之后、AI系统之前）
     */
    constructor(world: World, defaultSoldierConfig: any, getHeroEntityId: () => number | null, priority: number = 5.9) {
        super('BaseProductionSystem', priority);
        this.world = world;
        this.defaultSoldierConfig = defaultSoldierConfig;
        this.getHeroEntityId = getHeroEntityId;
    }

    /**
     * 系统启动时调用，获取依赖的系统引用
     */
    public onStart(): void {
        this.supplySystem = this.world.getSystem(SupplySystem);
        this.actionSystem = this.world.getSystem(ActionSystem);
    }

    /**
     * 获取本系统需要处理的组件类型列表
     * @returns 组件类型数组
     */
    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, FactionComponent, BaseProductionComponent];
    }

    /**
     * 每帧更新逻辑
     * 处理城堡的士兵生产：
     * 1. 初始人口爆发式生成
     * 2. 持续生产（受冷却时间和人口上限限制）
     * @param entities 拥有 BaseProductionComponent 的实体列表（通常是城堡）
     * @param deltaTime 帧时间
     */
    public update(entities: Entity[], deltaTime: number): void {
        for (const baseEntity of entities) {
            const prod = baseEntity.getComponent(BaseProductionComponent);
            const baseTr = baseEntity.getComponent(TransformComponent);
            const baseFaction = baseEntity.getComponent(FactionComponent);
            if (!prod || !baseTr || !baseFaction) continue;

            // 更新生产冷却时间
            prod.spawnCooldownRemaining = Math.max(0, prod.spawnCooldownRemaining - deltaTime);

            // V3: 更新重组计时器
            for (const configId in prod.regroupingTimers) {
                if (prod.regroupingTimers[configId] > 0) {
                    prod.regroupingTimers[configId] = Math.max(0, prod.regroupingTimers[configId] - deltaTime);
                }
            }

            // 获取所有属于此城堡的士兵
            const soldiers = this.world.getAllEntities().filter(e => e.active && e.hasComponent(SoldierComponent));
            const owned = soldiers
                .map(e => ({ e, s: e.getComponent(SoldierComponent)! }))
                .filter(x => x.s.baseEntityId === baseEntity.id);

            // 统计当前士兵数量和状态
            let total = owned.length;
            const followerDesired = Math.max(0, Math.min(prod.followerCap, prod.followerDesired));
            let followers = owned.filter(x => x.s.mode === 'Follower').length;
            const garrisonCount = owned.filter(x => x.s.mode === 'Garrison').length;

            // 如果生产被暂停（补给不足等原因），跳过
            if (this.supplySystem?.isProductionPaused(baseEntity.id) ?? false) {
                continue;
            }

            // 获取流派修正
            const heroId = this.getHeroEntityId();
            const hero = heroId !== null ? this.world.getEntity(heroId) : null;
            const playstyle = hero?.getComponent(PlaystyleComponent);
            const capOffset = playstyle?.soldierCapOffset ?? 0;
            const effectiveCap = Math.max(1, prod.populationCap + capOffset);

            // 处理初始人口爆发式生成
            if (!prod.initialSpawned && prod.initialPopulation > 0 && total < effectiveCap) {
                const remaining = Math.min(prod.initialPopulation, effectiveCap - total);
                const burst = Math.min(10, remaining); // 每帧最多生成10个
                for (let i = 0; i < burst; i++) {
                    const mode = followers < followerDesired ? 'Follower' : 'Garrison';
                    const configId = this.pickSoldierConfigId(prod);
                    if (!configId) break; // 都在 CD 中

                    const supplyCost = this.getSupplyCost(configId);
                    
                    // 消耗补给并生成士兵
                    if (this.supplySystem?.consumeSupply(baseEntity.id, supplyCost) ?? true) {
                        if (this.spawnOne(baseEntity, baseTr, prod, mode, garrisonCount, followers, followerDesired)) {
                            total++;
                            if (mode === 'Follower') followers++;
                        }
                    }
                }
                prod.initialPopulation = Math.max(0, prod.initialPopulation - burst);
                if (prod.initialPopulation <= 0) prod.initialSpawned = true;
            }

            // 处理持续生产（每帧最多生成3个）
            let spawnedThisFrame = 0;
            let followersSpawned = 0;
            let garrisonSpawned = 0;
            while (prod.spawnCooldownRemaining <= 0 && total + spawnedThisFrame < effectiveCap && spawnedThisFrame < 3) {
                const mode = followers + followersSpawned < followerDesired ? 'Follower' : 'Garrison';
                const g = garrisonCount + garrisonSpawned;
                const f = followers + followersSpawned;
                
                const configId = this.pickSoldierConfigId(prod);
                if (!configId) break; // 都在 CD 中

                const supplyCost = this.getSupplyCost(configId);
                
                // 补给不足时停止生产
                if (!(this.supplySystem?.consumeSupply(baseEntity.id, supplyCost) ?? true)) {
                    break;
                }
                
                // 生成士兵
                if (this.spawnOne(baseEntity, baseTr, prod, mode, g, f, followerDesired)) {
                    prod.spawnCooldownRemaining = prod.productionIntervalSeconds;
                    if (mode === 'Follower') followersSpawned++;
                    else garrisonSpawned++;
                    spawnedThisFrame++;
                } else {
                    break;
                }
            }
        }
    }

    /**
     * 士兵死亡时的回调
     * 通知补给系统扣除相应的补给
     * @param soldierEntity 死亡的士兵实体
     */
    public onSoldierDeath(soldierEntity: Entity): void {
        const soldier = soldierEntity.getComponent(SoldierComponent);
        if (!soldier) return;

        this.supplySystem?.deductOnDeath(soldier.baseEntityId);

        // V3: 触发兵种重组 CD
        if (soldier.configId && REGROUPING_CD[soldier.configId]) {
            const baseEntity = this.world.getEntity(soldier.baseEntityId);
            const prod = baseEntity?.getComponent(BaseProductionComponent);
            if (prod) {
                let cd = REGROUPING_CD[soldier.configId];
                
                // V3: 前 10 波重组 CD 减少 30%
                const gameMain = this.world.getAllEntities().find(e => e.name === 'GameMain');
                // 简单起见，这里假设我们可以从某个地方获取当前波次，或者直接通过 LevelLoader
                // 暂时实现基础 CD，后续可根据 WaveSystem 优化
                prod.regroupingTimers[soldier.configId] = cd;
            }
        }
    }

    /**
     * 获取士兵配置的补给消耗
     * @param configId 士兵配置ID
     * @returns 补给消耗值（1或2）
     */
    private getSupplyCost(configId: string): number {
        if (LOW_SUPPLY_UNITS.indexOf(configId) !== -1) {
            return 1;
        }
        if (HIGH_SUPPLY_UNITS.indexOf(configId) !== -1) {
            return 2;
        }
        return 1;
    }

    /**
     * 生成单个士兵
     * @param baseEntity 城堡实体
     * @param baseTr 城堡的变换组件
     * @param prod 城堡生产组件
     * @param mode 士兵模式（Garrison 驻守 / Follower 随从）
     * @param garrisonCount 当前驻守士兵数量
     * @param followerCount 当前随从数量
     * @param followerDesired 期望随从数量
     * @returns 是否成功生成
     */
    private spawnOne(
        baseEntity: Entity,
        baseTr: TransformComponent,
        prod: BaseProductionComponent,
        mode: 'Garrison' | 'Follower',
        garrisonCount: number,
        followerCount: number,
        followerDesired: number
    ): boolean {
        // 获取士兵配置
        const configId = this.pickSoldierConfigId(prod);
        const config = EntityConfigCache.get(configId) ?? this.defaultSoldierConfig;
        if (!config) return false;

        // 计算目标位置
        let targetPos = { x: baseTr.x, y: baseTr.y };
        let formationIndex = 0;

        if (mode === 'Garrison') {
            // 驻守士兵：在城堡左侧排队
            formationIndex = garrisonCount;
            targetPos = garrisonSlotPosition(baseTr.x, baseTr.y, prod, formationIndex);
        } else {
            // 随从士兵：围绕英雄排列
            formationIndex = followerCount;
            const heroId = this.getHeroEntityId();
            const heroTr = heroId !== null ? this.world.getEntity(heroId)?.getComponent(TransformComponent) : null;
            const hx = heroTr?.x ?? baseTr.x;
            const hy = heroTr?.y ?? baseTr.y;
            const ringTotal = Math.max(followerDesired, followerCount + 1);
            targetPos = followerSlotPosition(hx, hy, prod, formationIndex, ringTotal);
        }

        // 检查目标位置是否完全可行走（包括碰撞体积）
        const soldierRadius = 24; // 士兵碰撞半径
        const isTargetWalkable = this.isPositionFullyWalkable(targetPos.x, targetPos.y, soldierRadius);
        
        // 如果目标位置不可行走，在附近找一个新的可行走位置
        let finalTargetPos = targetPos;
        if (!isTargetWalkable) {
            const alternativePos = this.findWalkablePositionNearby(targetPos.x, targetPos.y, 60);
            if (alternativePos) {
                finalTargetPos = alternativePos;
            }
        }

        // 士兵总是从城堡附近的可行走位置生成
        // 这样看起来更自然，像是从城堡出来的
        const spawnPos = this.findWalkablePositionNearby(baseTr.x, baseTr.y, 80) || { x: baseTr.x + 50, y: baseTr.y };

        // 创建士兵实体
        const created = EntityFactory.createEntityFromConfig(this.world, config, spawnPos);
        created.name = `${config?.id || 'Soldier'}_${created.id}`;
        
        // 设置士兵组件属性
        const soldier = created.getComponent(SoldierComponent) ?? this.world.acquireComponent(SoldierComponent);
        soldier.mode = mode;
        soldier.baseEntityId = baseEntity.id;
        soldier.slotIndex = prod.nextSoldierIndex++;
        soldier.formationIndex = formationIndex;
        soldier.deployed = false;
        soldier.configId = configId;
        if (!created.hasComponent(SoldierComponent)) created.addComponent(soldier);

        // 应用战力倍率
        const powerMult = prod.soldierPowerMultiplier ?? 1.0;
        if (powerMult !== 1.0) {
            this.applyPowerMultiplier(created, powerMult);
        }

        // 让士兵走到最终目标位置（确保不会与障碍物碰撞）
        if (this.actionSystem) {
            this.actionSystem.setSingleAction(created, new WalkAction(created, { x: finalTargetPos.x, y: finalTargetPos.y }));
        }

        return true;
    }

    /**
     * 检查指定位置是否可行走（不与障碍物重叠）
     * @param x 位置X坐标
     * @param y 位置Y坐标
     * @param radius 检测半径（默认12，士兵碰撞半径）
     * @returns 是否可行走
     */
    private isPositionWalkable(x: number, y: number, radius: number = 12): boolean {
        // 获取所有阻挡移动的障碍物
        const obstacles = this.world
            .getAllEntities()
            .filter(e => e.active && e.hasComponent(ObstacleComponent) && e.hasComponent(TransformComponent) && e.hasComponent(ColliderComponent))
            .filter(e => e.getComponent(ObstacleComponent)!.blocksMovement);

        // 检查与每个障碍物是否重叠
        for (const obstacle of obstacles) {
            const otr = obstacle.getComponent(TransformComponent);
            const ocol = obstacle.getComponent(ColliderComponent);
            if (!otr || !ocol) continue;

            if (ocol.shape === ColliderShapeType.AABB) {
                // AABB矩形碰撞检测
                const halfW = ocol.width * 0.5;
                const halfH = ocol.height * 0.5;
                const minX = otr.x + ocol.offsetX - halfW;
                const maxX = otr.x + ocol.offsetX + halfW;
                const minY = otr.y + ocol.offsetY - halfH;
                const maxY = otr.y + ocol.offsetY + halfH;

                // 找到矩形上离检测点最近的点
                const closestX = Math.max(minX, Math.min(maxX, x));
                const closestY = Math.max(minY, Math.min(maxY, y));
                const dx = x - closestX;
                const dy = y - closestY;
                const distSq = dx * dx + dy * dy;
                
                // 如果距离小于检测半径，则不可行走
                if (distSq < radius * radius) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * 检查位置是否完全可行走（考虑整个碰撞圆的范围）
     * 不仅检查中心点，还检查周围一圈，确保整个碰撞体积都不会与障碍物重叠
     * @param x 位置 X 坐标
     * @param y 位置 Y 坐标
     * @param radius 碰撞半径
     * @returns 是否完全可行走
     */
    private isPositionFullyWalkable(x: number, y: number, radius: number): boolean {
        // 检查中心点
        if (!this.isPositionWalkable(x, y, radius)) {
            return false;
        }

        // 检查周围 8 个方向，确保整个圆都不会碰撞
        const checkPoints = [
            { x: x + radius * 0.707, y: y + radius * 0.707 },
            { x: x + radius * 0.707, y: y - radius * 0.707 },
            { x: x - radius * 0.707, y: y + radius * 0.707 },
            { x: x - radius * 0.707, y: y - radius * 0.707 },
            { x: x + radius, y: y },
            { x: x - radius, y: y },
            { x: x, y: y + radius },
            { x: x, y: y - radius },
        ];

        for (const point of checkPoints) {
            // 检查边缘点是否与障碍物太近（留一点余量）
            if (!this.isPositionWalkable(point.x, point.y, 2)) {
                return false;
            }
        }

        return true;
    }

    /**
     * 在指定位置附近寻找可行走的位置
     * 使用环形搜索策略，从近到远寻找第一个可行走的点
     * @param centerX 中心点X坐标
     * @param centerY 中心点Y坐标
     * @param maxRadius 最大搜索半径
     * @returns 可行走位置，如果找不到则返回null
     */
    private findWalkablePositionNearby(centerX: number, centerY: number, maxRadius: number): { x: number; y: number } | null {
        const checkRadius = 24; // 士兵碰撞半径（稍大以确保安全）
        const step = 20; // 搜索步长

        // 从近到远搜索环形上的点
        for (let r = step; r <= maxRadius; r += step) {
            // 在环形上均匀采样8个点
            const points = [
                { x: centerX + r, y: centerY },           // 右
                { x: centerX - r, y: centerY },           // 左
                { x: centerX, y: centerY + r },           // 上
                { x: centerX, y: centerY - r },           // 下
                { x: centerX + r * 0.707, y: centerY + r * 0.707 }, // 右上
                { x: centerX + r * 0.707, y: centerY - r * 0.707 }, // 右下
                { x: centerX - r * 0.707, y: centerY + r * 0.707 }, // 左上
                { x: centerX - r * 0.707, y: centerY - r * 0.707 }, // 左下
            ];

            // 检查每个点是否可行走
            for (const point of points) {
                if (this.isPositionWalkable(point.x, point.y, checkRadius)) {
                    return point;
                }
            }
        }

        return null;
    }

    /**
     * 应用战力倍率到实体属性
     * @param entity 目标实体
     * @param multiplier 倍率值
     */
    private applyPowerMultiplier(entity: Entity, multiplier: number): void {
        // 应用到生命值
        const health = entity.getComponent(HealthComponent);
        if (health) {
            health.max = Math.floor(health.max * multiplier);
            health.current = health.max;
        }

        // 应用到攻击力
        const weapon = entity.getComponent(WeaponComponent);
        if (weapon) {
            weapon.damage = Math.floor(weapon.damage * multiplier);
        }

        // 应用到防御力
        const defense = entity.getComponent(DefenseComponent);
        if (defense) {
            defense.defense = Math.floor(defense.defense * multiplier);
            defense.magicResist = Math.floor(defense.magicResist * multiplier);
        }
    }

    /**
     * 选择下一个士兵配置ID
     * 使用循环方式从配置列表中选取，并检查重组 CD
     * @param prod 城堡生产组件
     * @returns 士兵配置ID，如果都在 CD 中则返回 null
     */
    private pickSoldierConfigId(prod: BaseProductionComponent): string | null {
        // 获取可用的士兵配置列表，默认只有步兵
        const ids = prod.soldierConfigIds?.length > 0 ? prod.soldierConfigIds : ['Infantry'];
        
        // 尝试从当前索引开始找一个不在 CD 的兵种
        for (let i = 0; i < ids.length; i++) {
            const idx = (prod.nextSoldierIndex + i) % ids.length;
            const configId = ids[idx];
            
            if (!prod.regroupingTimers[configId] || prod.regroupingTimers[configId] <= 0) {
                // 找到了一个不在 CD 的兵种，但不在这里更新 nextSoldierIndex，由调用者在成功生成时处理
                return configId;
            }
        }
        
        return null; // 都在 CD 中
    }
}