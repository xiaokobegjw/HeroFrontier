import { _decorator, Component, Graphics, UITransform, Layers } from 'cc';
const { ccclass, property } = _decorator;

import { World } from '../ECS/Core/World';
import { ActionSystem } from './ECS/System/ActionSystem';
import { RenderSystem } from './ECS/System/RenderSystem';
import { RenderComponent } from '../ECS/Components/RenderComponent';
import { TransformComponent } from '../ECS/Components/TransformComponent';
import { BreedManager } from '../ECS/Managers/BreedManager';
import { Breed } from '../ECS/Data/Breed';
import { BreedRefComponent } from '../ECS/Components/BreedRefComponent';
import { WalkAction } from '../ECS/Actions/WalkAction';

/**
 * 游戏主入口脚本：挂载到场景节点
 */
@ccclass('GameMain')
export class GameMain extends Component {
    private world: World = null!;
    private actionSystem: ActionSystem = null!;
    private renderSystem: RenderSystem = null!;

    onLoad() {
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

        // 3. 初始化并注册 RenderSystem
        this.renderSystem = new RenderSystem(100);
        // 获取或添加 Cocos Graphics 组件
        let graphics = this.getComponent(Graphics);
        if (!graphics) {
            graphics = this.addComponent(Graphics);
        }
        this.renderSystem.setContext(graphics as any);
        this.world.registerSystem(this.renderSystem);

        // 4. 初始化游戏数据 (示例)
        this.setupInitialData();
    }

    start() {
        // 启动 ECS 世界
        this.world.start();

        // 创建一个测试实体
        this.createTestHero();
    }

    private setupInitialData() {
        // 注册一个共享种族模板
        const heroBreed = new Breed();
        heroBreed.name = "Hero";
        heroBreed.maxHealth = 100;
        BreedManager.register(1, heroBreed);
    }

    private createTestHero() {
        const hero = this.world.createEntity("HeroEntity");
        
        // 添加位置组件
        const transform = hero.addComponent(new TransformComponent(0, 0));

        // 添加种族引用
        const breedRef = hero.addComponent(new BreedRefComponent());
        breedRef.breedId = 1;

        // 添加渲染组件并绘制一个圆形
        const render = hero.addComponent(new RenderComponent());
        render.offset = { x: 0, y: 0 };
        render.addCircle(30, '#00FF00', true); // 绿色圆心

        // 给英雄加入一个动作
        this.actionSystem.enqueueAction(hero, new WalkAction(hero, { x: 300, y: 300 }));
    }

    update(deltaTime: number) {
        // 驱动 ECS 逻辑循环
        if (this.world) {
            this.world.update(deltaTime);
        }
    }

    onDestroy() {
        if (this.world) {
            this.world.clear();
        }
    }
}
