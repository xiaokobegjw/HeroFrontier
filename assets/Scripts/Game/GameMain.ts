import { _decorator, Component, Graphics, UITransform, Layers } from 'cc';
const { ccclass } = _decorator;

import { World } from '../Shared/ECS/Core/World';
import { ActionSystem } from '../Shared/ECS/Systems/ActionSystem';
import { RenderSystem } from '../Shared/ECS/Systems/RenderSystem';
import { CollisionSystem } from '../Shared/ECS/Systems/CollisionSystem';
import { TransformComponent } from '../Shared/ECS/Components/TransformComponent';
import { WalkAction } from '../Shared/ECS/Actions/WalkAction';
import { LocalizationManager, LanguageType, t } from './I18n/LocalizationManager';
import { EntityFactory } from './Managers/EntityFactory';
import { GameConfigManager } from '../Shared/Managers/GameConfigManager';
import heroConfig from '../../resources/configs/Entitys/Hero1.json';
import enemyConfig from '../../resources/configs/Entitys/Enemy1.json';
import { QuadTree } from '../Shared/Spatial/QuadTree';
import { HealthComponent } from './ECS/Components/HealthComponent';
import { PerceptionSystem } from './ECS/Systems/PerceptionSystem';

/**
 * 游戏主入口脚本：挂载到场景节点
 */
@ccclass('GameMain')
export class GameMain extends Component {
    private world: World = null!;
    private actionSystem: ActionSystem = null!;
    private renderSystem: RenderSystem = null!;
    private spatialIndex: QuadTree<{ id: number; bounds: { x: number; y: number; width: number; height: number } }> | null = null;
    private collisionSystem: CollisionSystem = null!;
    private perceptionSystem: PerceptionSystem = null!;

    onLoad() {
        // 打印环境配置
        console.log(GameConfigManager.instance.getEnvironmentInfo());

        // 初始化多语言
        LocalizationManager.instance.setLanguage(LanguageType.ZH);
        console.log(`[GameMain] Current Language: ${LocalizationManager.instance.getLanguage()}`);
        console.log(`[GameMain] Title: ${t('game_title')}`);

        // 确保空节点有 UITransform 组件，否则在 Canvas 下无法渲染
        let uiTransform = this.getComponent(UITransform);
        if (!uiTransform) {
            uiTransform = this.addComponent(UITransform);
        }

        // 确保节点的 Layer 设置为 UI_2D (与 Canvas 一致)
        this.node.layer = Layers.Enum.UI_2D;

        // 1. 初始化 ECS 世界
        this.world = new World();

        // 2. 初始化并注册 ActionSystem
        this.actionSystem = new ActionSystem(1);
        this.world.registerSystem(this.actionSystem);

        this.perceptionSystem = new PerceptionSystem(this.world, 5);
        this.world.registerSystem(this.perceptionSystem);

        // 3. 初始化并注册 RenderSystem
        this.renderSystem = new RenderSystem(100);
        // 获取或添加 Cocos Graphics 组件
        let graphics = this.getComponent(Graphics);
        if (!graphics) {
            graphics = this.addComponent(Graphics);
        }
        this.renderSystem.setContext(graphics as any);
        this.world.registerSystem(this.renderSystem);

        this.collisionSystem = new CollisionSystem(10, { x: 0, y: 0, width: 2000, height: 2000 });
        this.world.registerSystem(this.collisionSystem);
    }

    start() {
        // 启动 ECS 世界
        this.world.start();

        this.spatialIndex = new QuadTree<{ id: number; bounds: { x: number; y: number; width: number; height: number } }>(
            { x: 0, y: 0, width: 2000, height: 2000 },
            { capacity: 8, maxDepth: 8 }
        );

        // 方式1: 硬编码创建 (旧方式)
        // this.createTestHero();

        // 方式2: 从配置加载 (新方式)
        const heroFromConfig = EntityFactory.createEntityFromConfig(this.world, heroConfig, { x: 100, y: 100 });
        console.log(`[GameMain] Created entity from config: ${heroFromConfig.name}`);

        const health = heroFromConfig.getComponent(HealthComponent);
        if (health) {
            console.log(`[GameMain] Hero Health: ${health.current}/${health.max}`);
        }

        const transform = heroFromConfig.getComponent(TransformComponent);
        if (transform) {
            this.spatialIndex.insert({
                id: heroFromConfig.id,
                bounds: { x: transform.x - 1, y: transform.y - 1, width: 2, height: 2 }
            });

            const near = this.spatialIndex.query({ x: transform.x - 100, y: transform.y - 100, width: 200, height: 200 });
            console.log(`[GameMain] QuadTree Query Count (Hero Only): ${near.length}`);
        }

        const enemyPositions = [
            { x: 160, y: 100 },
            { x: 200, y: 140 },
            { x: 240, y: 100 }
        ];

        const enemies = enemyPositions.map((pos, index) => {
            const enemy = EntityFactory.createEntityFromConfig(this.world, enemyConfig, pos);
            enemy.name = `${enemyConfig.id}_${index + 1}`;
            return enemy;
        });
        console.log(`[GameMain] Spawned enemies from Enemy1.json: ${enemies.map(e => e.name).join(', ')}`);

        for (const enemy of enemies) {
            const enemyTransform = enemy.getComponent(TransformComponent);
            if (!enemyTransform) continue;
            this.spatialIndex.insert({
                id: enemy.id,
                bounds: { x: enemyTransform.x - 1, y: enemyTransform.y - 1, width: 2, height: 2 }
            });
        }

        if (transform) {
            const nearAll = this.spatialIndex.query({ x: transform.x - 150, y: transform.y - 150, width: 300, height: 300 });
            console.log(`[GameMain] QuadTree Query Count (Hero + Enemies): ${nearAll.length}`);
        }
    }

    update(deltaTime: number) {
        // 驱动 ECS 逻辑循环
        if (this.world) {
            this.world.update(deltaTime);
        }

        const events = this.collisionSystem?.drainEvents() ?? [];
        for (const ev of events) {
            const a = this.world.getEntity(ev.aId);
            const b = this.world.getEntity(ev.bId);
            if (!a || !b) continue;
            console.log(`[GameMain] Collision: ${a.name} <-> ${b.name}`);
        }
    }

    onDestroy() {
        if (this.world) {
            this.world.clear();
        }
    }
}
