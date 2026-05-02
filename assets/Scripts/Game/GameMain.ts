import { _decorator, Component, Graphics, UITransform, Layers, Node, Label, Color, view } from 'cc';
const { ccclass } = _decorator;

import { World } from '../Shared/ECS/Core/World';
import { ActionSystem } from '../Shared/ECS/Systems/ActionSystem';
import { RenderSystem } from '../Shared/ECS/Systems/RenderSystem';
import { CollisionSystem } from '../Shared/ECS/Systems/CollisionSystem';
import { TransformComponent } from '../Shared/ECS/Components/TransformComponent';
import { RenderComponent } from '../Shared/ECS/Components/RenderComponent';
import { ColliderComponent, ColliderShapeType } from '../Shared/ECS/Components/ColliderComponent';
import { LocalizationManager, LanguageType, t } from './I18n/LocalizationManager';
import { EntityFactory } from './Managers/EntityFactory';
import { GameConfigManager } from '../Shared/Managers/GameConfigManager';
import heroConfig from '../../resources/configs/Entitys/Hero1.json';
import enemyConfig from '../../resources/configs/Entitys/Enemy1.json';
import bowConfig from '../../resources/configs/Weapons/Bow1.json';
import swordConfig from '../../resources/configs/Weapons/Sword1.json';
import arrowConfig from '../../resources/configs/Projectiles/Arrow1.json';
import hero1Upgrade from '../../resources/configs/Upgrade/Hero1Upgrade.json';
import bow1Upgrade from '../../resources/configs/Upgrade/Bow1Upgrade.json';
import sword1Upgrade from '../../resources/configs/Upgrade/Sword1Upgrade.json';
import defaultSave from '../../resources/configs/Save/DefaultSave.json';
import { QuadTree } from '../Shared/Spatial/QuadTree';
import { HealthComponent } from './ECS/Components/HealthComponent';
import { PerceptionSystem } from './ECS/Systems/PerceptionSystem';
import { SpatialIndexSystem } from './ECS/Systems/SpatialIndexSystem';
import { NavigationSystem } from './ECS/Systems/NavigationSystem';
import { TargetingSystem } from './ECS/Systems/TargetingSystem';
import { AISystem } from './ECS/Systems/AISystem';
import { EquipmentSystem } from './ECS/Systems/EquipmentSystem';
import { UpgradeSystem } from './ECS/Systems/UpgradeSystem';
import { WeaponSystem } from './ECS/Systems/WeaponSystem';
import { ProjectileSystem } from './ECS/Systems/ProjectileSystem';
import { MeleeHitboxSystem } from './ECS/Systems/MeleeHitboxSystem';
import { DamageSystem } from './ECS/Systems/DamageSystem';
import { SaveManager, SaveData } from './Managers/SaveManager';
import { Entity } from '../Shared/ECS/Core/Entity';
import { DebugOverlaySystem } from './ECS/Systems/DebugOverlaySystem';
import { PerceptionComponent } from './ECS/Components/PerceptionComponent';
import { TargetComponent } from './ECS/Components/TargetComponent';
import { AIComponent } from './ECS/Components/AIComponent';
import { FactionComponent } from './ECS/Components/FactionComponent';
import { FactionType } from './Data/Faction';
import { MemoryComponent } from './ECS/Components/MemoryComponent';
import { CommandBus } from './Input/CommandBus';
import { DebugCommandAdapter } from './Input/DebugCommandAdapter';
import { DebugCommandContext } from './Input/DebugCommands';
import { DebugState } from './Debug/DebugState';

/**
 * 游戏主入口脚本：挂载到场景节点
 */
@ccclass('GameMain')
export class GameMain extends Component {
    private world: World = null!;
    private actionSystem: ActionSystem = null!;
    private spatialIndexSystem: SpatialIndexSystem = null!;
    private navigationSystem: NavigationSystem = null!;
    private aiSystem: AISystem = null!;
    private renderSystem: RenderSystem = null!;
    private debugOverlaySystem: DebugOverlaySystem | null = null;
    private spatialIndex: QuadTree<{ id: number; bounds: { x: number; y: number; width: number; height: number } }> | null = null;
    private collisionSystem: CollisionSystem = null!;
    private perceptionSystem: PerceptionSystem = null!;
    private targetingSystem: TargetingSystem = null!;
    private equipmentSystem: EquipmentSystem = null!;
    private upgradeSystem: UpgradeSystem = null!;
    private weaponSystem: WeaponSystem = null!;
    private projectileSystem: ProjectileSystem = null!;
    private meleeHitboxSystem: MeleeHitboxSystem = null!;
    private damageSystem: DamageSystem = null!;
    private playerEntity: Entity | null = null;
    private saveData: SaveData | null = null;
    private isPaused: boolean = false;
    private debugSelectedEntityId: number | null = null;
    private debugLabelNode: Node | null = null;
    private debugLabel: Label | null = null;
    private debugGoalNode: Node | null = null;
    private debugGoalLabel: Label | null = null;
    private debugDamageRoot: Node | null = null;
    private debugDamageLabels: Map<number, { node: Node; label: Label; ttl: number }> = new Map();
    private debugCommandBus: CommandBus | null = null;
    private debugInput: DebugCommandAdapter | null = null;

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

        this.spatialIndexSystem = new SpatialIndexSystem({ x: 0, y: 0, width: 2000, height: 2000 }, 4.9);
        this.world.registerSystem(this.spatialIndexSystem);

        this.perceptionSystem = new PerceptionSystem(this.world, 5);
        this.world.registerSystem(this.perceptionSystem);

        this.targetingSystem = new TargetingSystem(6);
        this.world.registerSystem(this.targetingSystem);

        this.navigationSystem = new NavigationSystem({ x: 0, y: 0, width: 2000, height: 2000 }, 40, 6.05);
        this.world.registerSystem(this.navigationSystem);

        this.aiSystem = new AISystem(this.world, this.actionSystem, 6.2);
        this.world.registerSystem(this.aiSystem);

        this.equipmentSystem = new EquipmentSystem(this.world, { Bow1: bowConfig, Sword1: swordConfig }, 6.5);
        this.world.registerSystem(this.equipmentSystem);

        this.upgradeSystem = new UpgradeSystem(this.world, { Hero1Upgrade: hero1Upgrade as any, Bow1Upgrade: bow1Upgrade as any, Sword1Upgrade: sword1Upgrade as any }, 6.8);
        this.world.registerSystem(this.upgradeSystem);

        this.weaponSystem = new WeaponSystem(this.world, { Arrow1: arrowConfig }, 7);
        this.world.registerSystem(this.weaponSystem);

        this.projectileSystem = new ProjectileSystem(this.world, 8);
        this.world.registerSystem(this.projectileSystem);

        this.meleeHitboxSystem = new MeleeHitboxSystem(this.world, 9);
        this.world.registerSystem(this.meleeHitboxSystem);

        // 3. 初始化并注册 RenderSystem
        this.renderSystem = new RenderSystem(100);
        // 获取或添加 Cocos Graphics 组件
        let graphics = this.getComponent(Graphics);
        if (!graphics) {
            graphics = this.addComponent(Graphics);
        }
        this.renderSystem.setContext(graphics as any);
        this.world.registerSystem(this.renderSystem);

        if (GameConfigManager.instance.isPC && GameConfigManager.instance.isDebug) {
            this.debugOverlaySystem = new DebugOverlaySystem(this.world, () => this.debugSelectedEntityId, 101);
            this.debugOverlaySystem.setContext(graphics as any);
            this.world.registerSystem(this.debugOverlaySystem);
        }

        this.collisionSystem = new CollisionSystem(10, { x: 0, y: 0, width: 2000, height: 2000 });
        this.world.registerSystem(this.collisionSystem);

        this.damageSystem = new DamageSystem(this.world, this.collisionSystem, 11);
        this.world.registerSystem(this.damageSystem);

        if (GameConfigManager.instance.isPC && GameConfigManager.instance.isDebug) {
            DebugState.enabled = true;
            this.debugCommandBus = new CommandBus();
            const ctx: DebugCommandContext = {
                togglePause: () => this.togglePause(),
                selectAt: (x: number, y: number) => this.selectEntityAt(x, y)
            };
            this.debugInput = new DebugCommandAdapter(this.debugCommandBus, ctx, uiTransform);
            this.debugInput.enable();
            this.createDebugLabel();
        }
    }

    start() {
        this.saveData = SaveManager.instance.loadOrDefault(defaultSave as SaveData);

        // 启动 ECS 世界
        this.world.start();

        this.spatialIndex = new QuadTree<{ id: number; bounds: { x: number; y: number; width: number; height: number } }>(
            { x: 0, y: 0, width: 2000, height: 2000 },
            { capacity: 8, maxDepth: 8 }
        );

        // 方式1: 硬编码创建 (旧方式)
        // this.createTestHero();

        // 方式2: 从配置加载 (新方式)
        const heroFromConfig = EntityFactory.createEntityFromConfig(this.world, heroConfig, { x: 500, y: 500 });
        SaveManager.instance.applyToPlayerEntity(heroFromConfig as any, this.saveData);
        this.playerEntity = heroFromConfig as any;
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
            { x: 760, y: 500 },
            { x: 800, y: 440 },
            { x: 640, y: 300 }
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
        this.debugCommandBus?.flush();
        this.updateDebugLabel();
        this.updateDebugDamagePopups(deltaTime);

        if (this.isPaused) {
            this.renderWhilePaused();
            return;
        }

        if (this.world) this.world.update(deltaTime);
    }

    onDestroy() {
        this.debugInput?.disable();
        this.debugCommandBus?.clear();
        this.debugInput = null;
        this.debugCommandBus = null;
        DebugState.enabled = false;
        DebugState.selectedEntityId = null;
        for (const v of this.debugDamageLabels.values()) v.node.destroy();
        this.debugDamageLabels.clear();
        this.debugDamageRoot?.destroy();
        this.debugDamageRoot = null;
        if (this.world && this.playerEntity && this.saveData) {
            const out = SaveManager.instance.extractFromPlayerEntity(this.playerEntity, this.saveData);
            out.progress.unlockedStages = this.saveData.progress.unlockedStages;
            SaveManager.instance.save(out);
            this.saveData = out;
        }
        if (this.world) {
            this.world.clear();
        }
    }

    private selectEntityAt(x: number, y: number): void {
        if (!this.world) return;
        if (this.spatialIndex) {
            this.rebuildSpatialIndexForSelection();
        }

        const candidateIds = this.spatialIndex
            ? this.spatialIndex
                  .query({ x: x - 1, y: y - 1, width: 2, height: 2 })
                  .map(item => item.id)
            : this.world.getAllEntities().map(ent => ent.id);

        const entities = candidateIds
            .map(id => this.world!.getEntity(id))
            .filter((ent): ent is Entity => !!ent && ent.active && ent.hasComponent(TransformComponent) && ent.hasComponent(ColliderComponent));
        let bestId: number | null = null;
        let bestDistSq = Infinity;

        for (const ent of entities) {
            const t = ent.getComponent(TransformComponent)!;
            const c = ent.getComponent(ColliderComponent)!;
            const cx = t.x + c.offsetX;
            const cy = t.y + c.offsetY;
            if (!this.pointInCollider(x, y, cx, cy, c)) continue;
            const dx = x - cx;
            const dy = y - cy;
            const dsq = dx * dx + dy * dy;
            if (dsq < bestDistSq) {
                bestDistSq = dsq;
                bestId = ent.id;
            }
        }

        this.debugSelectedEntityId = bestId;
        DebugState.selectedEntityId = bestId;
        this.updateDebugLabel();
    }

    private rebuildSpatialIndexForSelection(): void {
        if (!this.spatialIndex || !this.world) return;
        this.spatialIndex.clear();

        const entities = this.world
            .getAllEntities()
            .filter(ent => ent.active && ent.hasComponent(TransformComponent) && ent.hasComponent(ColliderComponent));

        for (const ent of entities) {
            const t = ent.getComponent(TransformComponent)!;
            const c = ent.getComponent(ColliderComponent)!;
            const cx = t.x + c.offsetX;
            const cy = t.y + c.offsetY;

            if (c.shape === ColliderShapeType.Circle) {
                const r = c.radius;
                this.spatialIndex.insert({ id: ent.id, bounds: { x: cx - r, y: cy - r, width: r * 2, height: r * 2 } });
            } else {
                const w = c.width;
                const h = c.height;
                this.spatialIndex.insert({ id: ent.id, bounds: { x: cx - w * 0.5, y: cy - h * 0.5, width: w, height: h } });
            }
        }
    }

    private togglePause(): void {
        if (!GameConfigManager.instance.isPC || !GameConfigManager.instance.isDebug) return;
        this.isPaused = !this.isPaused;
        console.log(`[GameMain] Paused: ${this.isPaused}`);
    }

    private pointInCollider(px: number, py: number, cx: number, cy: number, c: ColliderComponent): boolean {
        if (c.shape === ColliderShapeType.Circle) {
            const dx = px - cx;
            const dy = py - cy;
            return dx * dx + dy * dy <= c.radius * c.radius;
        }
        const halfW = c.width * 0.5;
        const halfH = c.height * 0.5;
        return px >= cx - halfW && px <= cx + halfW && py >= cy - halfH && py <= cy + halfH;
    }

    private createDebugLabel(): void {
        const size = view.getVisibleSize();
        const rootTransform = this.getComponent(UITransform);
        if (rootTransform) rootTransform.setContentSize(size);

        const damageRoot = new Node('DebugDamagePopups');
        this.node.addChild(damageRoot);
        this.debugDamageRoot = damageRoot;

        const node = new Node('DebugSelectionLabel');
        const panelTransform = node.addComponent(UITransform);
        panelTransform.setContentSize(720, 360);
        const label = node.addComponent(Label);
        label.string = '';
        label.color = new Color(255, 255, 255, 255);
        label.fontSize = 16;
        label.overflow = Label.Overflow.RESIZE_HEIGHT;
        label.enableWrapText = true;
        node.setPosition(-size.width * 0.5 + 12, size.height * 0.5 - 20, 0);
        this.node.addChild(node);
        this.debugLabelNode = node;
        this.debugLabel = label;

        const goalNode = new Node('DebugGoalPanel');
        const goalTransform = goalNode.addComponent(UITransform);
        goalTransform.setContentSize(320, 120);
        const goalLabel = goalNode.addComponent(Label);
        goalLabel.string = '';
        goalLabel.color = new Color(255, 255, 255, 255);
        goalLabel.fontSize = 14;
        goalLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
        goalLabel.enableWrapText = true;
        this.node.addChild(goalNode);
        this.debugGoalNode = goalNode;
        this.debugGoalLabel = goalLabel;
    }

    private updateDebugLabel(): void {
        if (!GameConfigManager.instance.isPC || !GameConfigManager.instance.isDebug) return;
        if (!this.debugLabel || !this.debugGoalLabel || !this.debugGoalNode) return;

        if (this.debugSelectedEntityId === null) {
            this.debugLabel.string = '';
            this.debugGoalLabel.string = '';
            return;
        }

        const ent = this.world?.getEntity(this.debugSelectedEntityId);
        if (!ent) {
            this.debugLabel.string = '';
            this.debugGoalLabel.string = '';
            return;
        }

        const faction = ent.getComponent(FactionComponent);
        const factionName = faction?.faction === FactionType.Player ? 'Hero' : faction?.faction === FactionType.Enemy ? 'Enemy' : 'Neutral';

        const perception = ent.getComponent(PerceptionComponent);
        const fov = perception ? `${perception.fovDeg}deg/${perception.viewRange}` : '-';

        const health = ent.getComponent(HealthComponent);
        const hp = health ? `${health.current}/${health.max}${health.isDead ? ' (Dead)' : ''}` : '-';

        const ai = ent.getComponent(AIComponent);
        const goalId = ai?.activeGoalId ?? '';
        const goalType = ai?.goals.find(g => g.id === goalId)?.type ?? '';

        const memory = ent.getComponent(MemoryComponent);
        const enemyIds = memory?.records?.map(r => r.entityId).join(', ') ?? '';

        const target = ent.getComponent(TargetComponent);
        const targetId = target?.targetEntityId ?? null;
        const targetPos =
            targetId !== null
                ? (() => {
                      const te = this.world?.getEntity(targetId ?? -1);
                      const tt = te?.getComponent(TransformComponent);
                      if (tt) 
                        return `(${tt.x.toFixed(0)},${tt.y.toFixed(0)})`;

                      if (target && Number.isFinite(target.targetX) && Number.isFinite(target.targetY)) 
                      {
                          return `(${target.targetX.toFixed(0)},${target.targetY.toFixed(0)})`;
                      }
                      
                      return '-';
                  })()
                : target && Number.isFinite(target.targetX) && Number.isFinite(target.targetY)
                  ? `(${target.targetX.toFixed(0)},${target.targetY.toFixed(0)})`
                  : '-';

        const paused = this.isPaused ? 'Paused' : 'Running';
        this.debugLabel.string = `Selected: ${ent.name} #${ent.id} [${factionName}]\nSelfId: ${ent.id}\nHP: ${hp}\nEnemyIds: ${enemyIds || '-'}\nFOV: ${fov}\nGoal: ${goalId}${goalType ? ` (${goalType})` : ''}\nTarget: ${targetId === null ? 'None' : `#${targetId}`} ${targetPos}\n${paused}`;

        const transform = ent.getComponent(TransformComponent);
        if (!transform) {
            this.debugGoalLabel.string = '';
            return;
        }

        this.debugGoalNode.setPosition(transform.x + 18, transform.y + 26, 0);
        const targetIdStr = targetId === null ? '-' : `#${targetId}`;
        const goalStr = goalId ? `${goalId}${goalType ? ` (${goalType})` : ''}` : '-';
        const hpStr = health ? `${health.current}/${health.max}${health.isDead ? ' (Dead)' : ''}` : '-';
        this.debugGoalLabel.string = `Self: #${ent.id}  Target: ${targetIdStr}\nHP: ${hpStr}\nGoal: ${goalStr}`;
    }

    private updateDebugDamagePopups(deltaTime: number): void {
        if (!GameConfigManager.instance.isPC || !GameConfigManager.instance.isDebug) return;
        if (!this.world || !this.debugDamageRoot) return;

        const events = DebugState.drainDamageEvents();
        for (const ev of events) {
            const existing = this.debugDamageLabels.get(ev.entityId);
            if (existing) {
                existing.ttl = 1.2;
                existing.label.string = `${ev.current}/${ev.max}`;
                continue;
            }

            const node = new Node(`HP_${ev.entityId}`);
            const t = node.addComponent(UITransform);
            t.setContentSize(120, 40);
            const label = node.addComponent(Label);
            label.string = `${ev.current}/${ev.max}`;
            label.color = new Color(255, 80, 80, 255);
            label.fontSize = 14;
            label.overflow = Label.Overflow.RESIZE_HEIGHT;
            label.enableWrapText = true;
            this.debugDamageRoot.addChild(node);

            this.debugDamageLabels.set(ev.entityId, { node, label, ttl: 1.2 });
        }

        for (const [entityId, popup] of this.debugDamageLabels) {
            popup.ttl -= deltaTime;
            if (popup.ttl <= 0) {
                popup.node.destroy();
                this.debugDamageLabels.delete(entityId);
                continue;
            }

            const ent = this.world.getEntity(entityId);
            const tr = ent?.getComponent(TransformComponent);
            if (ent && ent.active && tr) {
                popup.node.setPosition(tr.x, tr.y + 44, 0);
            }
        }
    }

    private renderWhilePaused(): void {
        if (!this.world) return;
        const renderEntities = this.world
            .getAllEntities()
            .filter(ent => ent.active && ent.hasComponent(RenderComponent) && ent.hasComponent(TransformComponent));
        this.renderSystem.update(renderEntities, 0);
        this.debugOverlaySystem?.update([], 0);
    }
}
