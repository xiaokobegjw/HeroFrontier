import { _decorator, Component, Graphics, UITransform, Layers, Node, Label, Color, view, Sprite } from 'cc';
const { ccclass, property } = _decorator;

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
import heroConfig from '../../resources/configs/Entitys/Hero.json';
import enemyConfig from '../../resources/configs/Entitys/EnemyMob1.json';
import bowConfig from '../../resources/configs/Weapons/Bow1.json';
import swordConfig from '../../resources/configs/Weapons/Sword1.json';
import arrowConfig from '../../resources/configs/Projectiles/Arrow1.json';
import hero1Upgrade from '../../resources/configs/Upgrade/Hero1Upgrade.json';
import bow1Upgrade from '../../resources/configs/Upgrade/Bow1Upgrade.json';
import sword1Upgrade from '../../resources/configs/Upgrade/Sword1Upgrade.json';
import hero1Skill1Config from '../../resources/configs/Skills/Hero1_Skill1.json';
import { SkillSystem } from './ECS/Systems/SkillSystem';
import defaultSave from '../../resources/configs/Save/DefaultSave.json';
import castleConfig from '../../resources/configs/Entitys/Castle.json';
import castle1Upgrade from '../../resources/configs/Upgrade/Castle1Upgrade.json';
import soldierConfig from '../../resources/configs/Entitys/Infantry.json';
import { QuadTree } from '../Shared/Spatial/QuadTree';
import { HealthComponent } from './ECS/Components/HealthComponent';
import { PerceptionSystem } from './ECS/Systems/PerceptionSystem';
import { SpatialIndexSystem } from './ECS/Systems/SpatialIndexSystem';
import { TargetingSystem } from './ECS/Systems/TargetingSystem';
import { AISystem } from './ECS/Systems/AISystem';
import { EquipmentSystem } from './ECS/Systems/EquipmentSystem';
import { UpgradeSystem } from './ECS/Systems/UpgradeSystem';
import { WeaponSystem } from './ECS/Systems/WeaponSystem';
import { ProjectileSystem } from './ECS/Systems/ProjectileSystem';
import { MeleeHitboxSystem } from './ECS/Systems/MeleeHitboxSystem';
import { DamageSystem } from './ECS/Systems/DamageSystem';
import { CurrencySystem } from './ECS/Systems/CurrencySystem';
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
import { PlayerMoveInputAdapter } from './Input/PlayerMoveInputAdapter';
import { DebugState } from './Debug/DebugState';
import { LevelLoader, LevelPoint } from './Managers/LevelLoader';
import { LoadingScreen } from './UI/LoadingScreen';
import { ObstacleComponent } from './ECS/Components/ObstacleComponent';
import { EntityConfigCache } from './Managers/EntityConfigCache';
import { PathFollowSystem } from './ECS/Systems/PathFollowSystem';
import { PathFollowComponent } from './ECS/Components/PathFollowComponent';
import { BaseProductionSystem } from './ECS/Systems/BaseProductionSystem';
import { SupplySystem } from './ECS/Systems/SupplySystem';
import { SoldierFormationSystem } from './ECS/Systems/SoldierFormationSystem';
import { MovementBlockSystem } from './ECS/Systems/MovementBlockSystem';
import { UnitSeparationSystem } from './ECS/Systems/UnitSeparationSystem';
import { ActorViewSystem } from './ECS/Systems/ActorViewSystem';
import { ExperienceSystem } from './ECS/Systems/ExperienceSystem';
import { ExperienceComponent } from './ECS/Components/ExperienceComponent';
import { PlayerControlSystem } from './ECS/Systems/PlayerControlSystem';
import { BurningSystem } from './ECS/Systems/BurningSystem';
import magicBoltConfig from '../../resources/configs/Projectiles/MagicBolt1.json';
import arrowTower1Upgrade from '../../resources/configs/Upgrade/ArrowTower1Upgrade.json';
import magicTower1Upgrade from '../../resources/configs/Upgrade/MagicTower1Upgrade.json';
import { GameSession } from './Managers/GameSession';
import { WaveSpawner, SpawnEvent } from './Managers/WaveSpawner';
import { TowerPlacementManager } from './Managers/TowerPlacementManager';
import { GameUIController } from './UI/GameUIController';
import { HUDManager } from './UI/HUDManager';
import { LevelComponent } from './ECS/Components/LevelComponent';
import { BaseProductionComponent } from './ECS/Components/BaseProductionComponent';
import { DefenseComponent } from './ECS/Components/DefenseComponent';
import { LootComponent } from './ECS/Components/LootComponent';
import { director } from 'cc';

const CASTLE_UPGRADE_COSTS = [0, 160, 280, 420, 600];
const STARTING_GOLD = 200;

/**
 * 游戏主入口脚本：挂载到场景节点
 */
@ccclass('GameMain')
export class GameMain extends Component {
    private world: World = null!;
    private actionSystem: ActionSystem = null!;
    private spatialIndexSystem: SpatialIndexSystem = null!;
    private aiSystem: AISystem = null!;
    private renderSystem: RenderSystem = null!;
    @property(Node)
    public levelBgNode: Node | null = null;
    @property(Node)
    public entityRootNode: Node | null = null;
    private debugOverlaySystem: DebugOverlaySystem | null = null;
    private spatialIndex: QuadTree<{ id: number; bounds: { x: number; y: number; width: number; height: number } }> | null = null;
    private collisionSystem: CollisionSystem = null!;
    private perceptionSystem: PerceptionSystem = null!;
    private targetingSystem: TargetingSystem = null!;
    private equipmentSystem: EquipmentSystem = null!;
    private skillSystem: SkillSystem = null!;
    private upgradeSystem: UpgradeSystem = null!;
    private weaponSystem: WeaponSystem = null!;
    private projectileSystem: ProjectileSystem = null!;
    private meleeHitboxSystem: MeleeHitboxSystem = null!;
    private damageSystem: DamageSystem = null!;
    private experienceSystem: ExperienceSystem | null = null;
    private currencySystem: CurrencySystem = null!;
    private actorViewSystem: ActorViewSystem | null = null;
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
    private playerMoveInput: PlayerMoveInputAdapter | null = null;
    private playerControlSystem: PlayerControlSystem | null = null;
    private levelTimeSeconds: number = 0;
    private spawnQueue: SpawnEvent[] = [];
    private levelPaths: Map<string, { x: number; y: number }[]> = new Map();
    private baseEntityId: number | null = null;
    private waveSpawner: WaveSpawner | null = null;
    private towerManager: TowerPlacementManager = new TowerPlacementManager();
    private gameUI: GameUIController | null = null;
    private hudManager: HUDManager | null = null;
    private currentSpawnWave: number = 1;
    private maxWaves: number = 12; // 默认最大波次
    private selectedTowerSlot: number = 0;

    onLoad() {
        GameSession.reset();
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

        let entityRoot = this.entityRootNode ?? this.node.getChildByName('EntityNode');
        if (!entityRoot) {
            entityRoot = new Node('EntityNode');
            this.node.addChild(entityRoot);
        }
        this.entityRootNode = entityRoot;
        entityRoot.layer = Layers.Enum.UI_2D;
        entityRoot.setPosition(0, 0, 0);
        entityRoot.getComponent(UITransform) ?? entityRoot.addComponent(UITransform);

        // 1. 初始化 ECS 世界
        this.world = new World();

        // 2. 初始化并注册 ActionSystem
        this.actionSystem = new ActionSystem(1);
        this.world.registerSystem(this.actionSystem);

        this.world.registerSystem(new MovementBlockSystem(this.world, 4.85));
        this.world.registerSystem(new UnitSeparationSystem(this.world, 4.86));

        this.spatialIndexSystem = new SpatialIndexSystem({ x: -1000, y: -1000, width: 2000, height: 2000 }, 4.9);
        this.world.registerSystem(this.spatialIndexSystem);

        this.perceptionSystem = new PerceptionSystem(this.world, 5);
        this.world.registerSystem(this.perceptionSystem);

        this.targetingSystem = new TargetingSystem(6);
        this.world.registerSystem(this.targetingSystem);

        this.world.registerSystem(new SupplySystem(this.world, 5.8));
        this.world.registerSystem(
            new BaseProductionSystem(this.world, soldierConfig as any, () => this.playerEntity?.id ?? null, 5.95)
        );
        this.world.registerSystem(new SoldierFormationSystem(this.world, this.actionSystem, () => this.playerEntity?.id ?? null, 6.05));

        this.world.registerSystem(new PathFollowSystem(this.world, this.actionSystem, () => this.baseEntityId, 6.1));

        this.aiSystem = new AISystem(this.world, this.actionSystem, 6.2);
        this.world.registerSystem(this.aiSystem);

        this.playerMoveInput = new PlayerMoveInputAdapter();
        this.playerMoveInput.enable();
        this.playerControlSystem = new PlayerControlSystem(this.world, this.actionSystem, this.playerMoveInput, () => this.playerEntity?.id ?? null, 6.3);
        this.world.registerSystem(this.playerControlSystem);

        this.equipmentSystem = new EquipmentSystem(this.world, { Bow1: bowConfig, Sword1: swordConfig }, 6.5);
        this.world.registerSystem(this.equipmentSystem);

        this.skillSystem = new SkillSystem(this.world, { Hero1_Skill1: hero1Skill1Config as any }, 6.45);
        this.world.registerSystem(this.skillSystem);

        this.upgradeSystem = new UpgradeSystem(
            this.world,
            {
                Hero1Upgrade: hero1Upgrade as any,
                Bow1Upgrade: bow1Upgrade as any,
                Sword1Upgrade: sword1Upgrade as any,
                Castle1Upgrade: castle1Upgrade as any,
                ArrowTower1Upgrade: arrowTower1Upgrade as any,
                MagicTower1Upgrade: magicTower1Upgrade as any
            },
            6.8
        );
        this.world.registerSystem(this.upgradeSystem);

        this.weaponSystem = new WeaponSystem(this.world, { Arrow1: arrowConfig, MagicBolt1: magicBoltConfig }, 7);
        this.world.registerSystem(this.weaponSystem);

        this.projectileSystem = new ProjectileSystem(this.world, 8);
        this.world.registerSystem(this.projectileSystem);

        this.meleeHitboxSystem = new MeleeHitboxSystem(this.world, 9);
        this.world.registerSystem(this.meleeHitboxSystem);

        // 3. 初始化并注册 RenderSystem
        this.renderSystem = new RenderSystem(100);
        const entityRootNode = this.entityRootNode ?? this.node;
        let graphics = entityRootNode.getComponent(Graphics);
        if (!graphics) {
            graphics = entityRootNode.addComponent(Graphics);
        }
        this.renderSystem.setContext(graphics as any);
        this.world.registerSystem(this.renderSystem);

        if (entityRootNode) {
            this.actorViewSystem = new ActorViewSystem(this.world, entityRootNode, 99);
            this.world.registerSystem(this.actorViewSystem);
        }

        if (GameConfigManager.instance.isPC && GameConfigManager.instance.isDebug) {
            this.debugOverlaySystem = new DebugOverlaySystem(this.world, () => this.debugSelectedEntityId, 101);
            this.debugOverlaySystem.setContext(graphics as any);
            this.world.registerSystem(this.debugOverlaySystem);
        }

        this.collisionSystem = new CollisionSystem(10, { x: -1000, y: -1000, width: 2000, height: 2000 });
        this.world.registerSystem(this.collisionSystem);

        this.damageSystem = new DamageSystem(this.world, this.collisionSystem, 11);
        this.world.registerSystem(this.damageSystem);

        this.world.registerSystem(new BurningSystem(this.world, 11.1));

        this.experienceSystem = new ExperienceSystem(this.world, () => this.playerEntity?.id ?? null, 11.25);
        this.world.registerSystem(this.experienceSystem);

        this.currencySystem = new CurrencySystem(11.5);
        this.world.registerSystem(this.currencySystem);

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

        const ui = this.node.getComponent(GameUIController) ?? this.node.addComponent(GameUIController);
        this.gameUI = ui;
        ui.init({
            getWorld: () => this.world,
            getCurrency: () => this.currencySystem,
            getBaseEntityId: () => this.baseEntityId,
            getTowerManager: () => this.towerManager,
            upgradeCastle: () => this.tryUpgradeCastle(),
            selectTowerSlot: (slot) => {
                this.selectedTowerSlot = slot;
            },
            buildArrowTower: (slot) => {
                this.selectedTowerSlot = slot;
                void this.tryBuildTower(slot, 'ArrowTower');
            },
            buildMagicTower: (slot) => {
                this.selectedTowerSlot = slot;
                void this.tryBuildTower(slot, 'MagicTower');
            },
            upgradeSelectedTower: () => this.tryUpgradeSelectedTower(),
            sellSelectedTower: () => this.trySellSelectedTower(),
            castSkill: (skillIndex: number, targetEntityId: number | null = null, x: number = 0, y: number = 0) => {
                if (!this.playerEntity) return;
                this.skillSystem.requestCast(this.playerEntity.id, skillIndex, targetEntityId, x, y);
            },
            restartGame: () => this.restartGame()
        });

        // 初始化 HUDManager
        const hudNode = this.node.getComponent(HUDManager) ?? this.node.addComponent(HUDManager);
        this.hudManager = hudNode;
    }

    start() {
        this.saveData = SaveManager.instance.loadOrDefault(defaultSave as SaveData);

        // 查找 LoadingScreen 节点并监听加载完成事件
        const loadingScreenNode = this.node.getChildByName('LoadingNode');
        if (loadingScreenNode) {
            const loadingScreen = loadingScreenNode.getComponent(LoadingScreen);
            if (loadingScreen) {
                console.log('[GameMain] Waiting for loading to complete...');
                loadingScreenNode.on('loadingComplete', this.onLoadingComplete, this);
                return;
            }
        }

        // 如果没有 LoadingScreen，直接开始游戏
        this.initGame();
    }

    private onLoadingComplete() {
        console.log('[GameMain] Loading completed, initializing game...');
        const loadingScreenNode = this.node.getChildByName('LoadingNode');
        if (loadingScreenNode) {
            loadingScreenNode.off('loadingComplete', this.onLoadingComplete, this);
        }
        this.initGame();
    }

    private initGame() {
        // 启动 ECS 世界
        this.world.start();

        this.spatialIndex = new QuadTree<{ id: number; bounds: { x: number; y: number; width: number; height: number } }>(
            { x: -1000, y: -1000, width: 2000, height: 2000 },
            { capacity: 8, maxDepth: 8 }
        );

        this.loadLevelAndSpawn('levels/level1').catch(err => console.error('[GameMain] loadLevelAndSpawn failed', err));
    }

    private async loadLevelAndSpawn(levelResourcePathNoExt: string): Promise<void> {
        const level = await LevelLoader.loadLevelJson(levelResourcePathNoExt);

        const cellSize = Math.max(4, Math.floor(level.cellSize));
        const gridW = Math.max(1, Math.floor(level.gridW));
        const gridH = Math.max(1, Math.floor(level.gridH));
        const levelW = gridW * cellSize;
        const levelH = gridH * cellSize;

        try {
            const alpha = Math.max(0, Math.min(1, typeof level.backgroundOpacity === 'number' ? level.backgroundOpacity : 1));
            let bgNode = this.levelBgNode;
            if (!bgNode) {
                bgNode = new Node('LevelBackground');
                this.node.addChild(bgNode);
                this.levelBgNode = bgNode;
            }

            bgNode.setPosition(0, 0, 0);
            bgNode.setSiblingIndex(0);

            const entityRootNode = this.entityRootNode;
            if (entityRootNode) {
                entityRootNode.setSiblingIndex(1);
                const entityUi = entityRootNode.getComponent(UITransform) ?? entityRootNode.addComponent(UITransform);
                entityUi.setContentSize(levelW, levelH);
                entityUi.setAnchorPoint(0.5, 0.5);
            }

            const ui = bgNode.getComponent(UITransform) ?? bgNode.addComponent(UITransform);
            ui.setContentSize(levelW, levelH);
            ui.setAnchorPoint(0.5, 0.5);

            const sprite = bgNode.getComponent(Sprite) ?? bgNode.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            if (!sprite.spriteFrame) {
                const bg: any = (level as any).background;
                if (bg && bg.type === 'ccres' && typeof bg.path === 'string' && bg.path.trim()) {
                    sprite.spriteFrame = await LevelLoader.loadLevelSpriteFrame(bg.path.trim());
                } else {
                    try {
                        sprite.spriteFrame = await LevelLoader.loadLevelSpriteFrame(`${levelResourcePathNoExt}/spriteFrame`);
                    } catch {
                        sprite.spriteFrame = await LevelLoader.loadLevelSpriteFrame(levelResourcePathNoExt);
                    }
                }
            }
            sprite.color = new Color(255, 255, 255, Math.round(alpha * 255));
        } catch (err) {
            console.warn('[GameMain] Failed to load level background spriteFrame', err);
        }

        const legacyTopLeft = Math.floor((level as any).version ?? 1) < 4;

        const toWorldPos = (p: LevelPoint | null | undefined): { x: number; y: number } => {
            if (!p) return { x: 0, y: 0 };
            const x = typeof p.px === 'number' ? p.px : (p.gx + 0.5) * cellSize;
            const yRaw = typeof p.py === 'number' ? p.py : (p.gy + 0.5) * cellSize;
            const y = legacyTopLeft ? levelH * 0.5 - yRaw : yRaw - levelH * 0.5;
            return { x: x - levelW * 0.5, y };
        };

        const rawObstacles: any[] | null = Array.isArray((level as any).obstacles) ? (level as any).obstacles : null;
        if (rawObstacles && rawObstacles.length > 0) {
            for (let i = 0; i < rawObstacles.length; i++) {
                const p = rawObstacles[i] as any;
                if (!p) continue;
                const pos = toWorldPos(p as any);
                const ent = this.world.createEntity('Obstacle');
                ent.name = `Obstacle_${i + 1}`;

                const tr = this.world.acquireComponent(TransformComponent);
                tr.x = pos.x;
                tr.y = pos.y;
                ent.addComponent(tr);

                const col = this.world.acquireComponent(ColliderComponent);
                col.shape = ColliderShapeType.AABB;
                col.isTrigger = false;
                col.width = cellSize;
                col.height = cellSize;
                col.layer = 16;
                col.mask = 0;
                ent.addComponent(col);

                const obs = this.world.acquireComponent(ObstacleComponent);
                obs.blocksMovement = true;
                ent.addComponent(obs);

                const render = this.world.acquireComponent(RenderComponent);
                render.offset = { x: 0, y: 0 };
                render.addSquare(cellSize, [120, 120, 120, 120], true);
                ent.addComponent(render);
            }
        }

        const heroPos = toWorldPos((level as any).hero);
        const heroFromConfig = EntityFactory.createEntityFromConfig(this.world, heroConfig, heroPos);
        SaveManager.instance.applyToPlayerEntity(heroFromConfig as any, this.saveData);
        this.playerEntity = heroFromConfig as any;

        const basePos = toWorldPos((level as any).base);
        const baseEntity = EntityFactory.createEntityFromConfig(this.world, castleConfig as any, basePos);
        baseEntity.name = 'Base';
        this.baseEntityId = baseEntity.id;

        const rawTowerSlots: any[] | null = Array.isArray((level as any).towerSlots) ? (level as any).towerSlots : null;
        if (rawTowerSlots && rawTowerSlots.length > 0) {
            this.towerManager.setSlots(rawTowerSlots.map((p: LevelPoint) => toWorldPos(p)));
        }

        this.currencySystem.addGold(STARTING_GOLD);
        GameSession.instance.setWave(1);
        this.currentSpawnWave = 1;

        this.levelTimeSeconds = 0;
        this.spawnQueue = [];
        this.levelPaths = new Map();

        const rawPaths: any[] | null = Array.isArray((level as any).paths) ? (level as any).paths : null;
        if (rawPaths) {
            for (const rp of rawPaths) {
                if (!rp || typeof rp !== 'object') continue;
                const id = typeof rp.id === 'string' && rp.id.trim() ? rp.id.trim() : '';
                if (!id) continue;
                const pts: { x: number; y: number }[] = [];
                const addPt = (p: any) => {
                    if (!p) return;
                    pts.push(toWorldPos(p as LevelPoint));
                };
                addPt(rp.start);
                if (Array.isArray(rp.waypoints)) for (const p of rp.waypoints) addPt(p);
                addPt(rp.end ?? (level as any).base);
                if (pts.length > 0) this.levelPaths.set(id, pts);
            }
        }

        const rawWaves: any[] | null = Array.isArray((level as any).waves) ? (level as any).waves : null;
        if (rawWaves && rawWaves.length > 0) {
            const waveSpawnDuration = (w: any): number => {
                const groups: any[] = Array.isArray(w?.groups) ? w.groups : [];
                let end = 0;
                for (const g of groups) {
                    if (!g) continue;
                    const spawnOffset = typeof g.spawnOffset === 'number' && Number.isFinite(g.spawnOffset) ? Math.max(0, g.spawnOffset) : 0;
                    const count = typeof g.count === 'number' && Number.isFinite(g.count) ? Math.max(1, Math.floor(g.count)) : 1;
                    const interval = typeof g.interval === 'number' && Number.isFinite(g.interval) ? Math.max(0.01, g.interval) : 1;
                    const dur = spawnOffset + Math.max(0, count - 1) * interval;
                    if (dur > end) end = dur;
                }
                return end;
            };

            const enemyIds = new Set<string>();
            const absStartByIndex: number[] = [];
            let abs = 0;
            let prevDur = 0;
            for (let i = 0; i < rawWaves.length; i++) {
                const wv = rawWaves[i];
                const delay =
                    typeof wv?.delay === 'number' && Number.isFinite(wv.delay)
                        ? Math.max(0, wv.delay)
                        : typeof wv?.startAt === 'number' && Number.isFinite(wv.startAt)
                          ? Math.max(0, wv.startAt)
                          : 0;
                abs = i === 0 ? delay : abs + prevDur + delay;
                absStartByIndex[i] = abs;
                prevDur = waveSpawnDuration(wv);
            }

            for (let wi = 0; wi < rawWaves.length; wi++) {
                const wv = rawWaves[wi];
                const groups: any[] = Array.isArray(wv?.groups) ? wv.groups : [];
                const waveStart = absStartByIndex[wi] ?? 0;
                for (const g of groups) {
                    if (!g) continue;
                    const enemyId = typeof g.enemyId === 'string' ? g.enemyId.trim() : '';
                    const pathId = typeof g.pathId === 'string' ? g.pathId.trim() : '';
                    if (!enemyId || !pathId) continue;
                    const count = typeof g.count === 'number' && Number.isFinite(g.count) ? Math.max(1, Math.floor(g.count)) : 1;
                    const interval = typeof g.interval === 'number' && Number.isFinite(g.interval) ? Math.max(0.01, g.interval) : 1;
                    const spawnOffset = typeof g.spawnOffset === 'number' && Number.isFinite(g.spawnOffset) ? Math.max(0, g.spawnOffset) : 0;
                    enemyIds.add(enemyId);
                    const waveNum = wi + 1;
                    for (let i = 0; i < count; i++) {
                        const t = waveStart + spawnOffset + i * interval;
                        this.spawnQueue.push({ time: t, enemyId, pathId, wave: waveNum });
                    }
                }
            }
            this.spawnQueue.sort((a, b) => a.time - b.time);

            const pathIds = Array.from(this.levelPaths.keys());
            this.waveSpawner = new WaveSpawner({ pathIds });
            const lastTime = this.spawnQueue.length > 0 ? this.spawnQueue[this.spawnQueue.length - 1].time : 0;
            this.waveSpawner.setStartTime(lastTime);
            const proceduralWaveCount = 12;
            this.waveSpawner.appendProceduralWaves(this.spawnQueue, lastTime + 6, proceduralWaveCount);
            this.spawnQueue.sort((a, b) => a.time - b.time);

            // 设置最大波次数量
            this.maxWaves = rawWaves.length + proceduralWaveCount;

            const ids = Array.from(enemyIds);
            await Promise.all(
                ids.map(async (id) => {
                    try {
                        await EntityConfigCache.loadEntityConfig(id);
                    } catch (e) {
                        console.warn(`[GameMain] Failed to preload enemy config: ${id}`, e);
                    }
                })
            );
        } else {
            const spawns =
                Array.isArray((level as any).enemySpawns) && (level as any).enemySpawns.length > 0
                    ? (level as any).enemySpawns
                    : [{ gx: 0, gy: legacyTopLeft ? gridH - 1 : 0 }];

            for (let index = 0; index < spawns.length; index++) {
                const p = spawns[index];
                const pos = toWorldPos(p);
                const enemy = EntityFactory.createEntityFromConfig(this.world, enemyConfig, pos);
                enemy.name = `${enemyConfig.id}_${index + 1}`;
            }
        }

        const heroTransform = heroFromConfig.getComponent(TransformComponent);
        if (heroTransform) {
            this.spatialIndex.insert({ id: heroFromConfig.id, bounds: { x: heroTransform.x - 1, y: heroTransform.y - 1, width: 2, height: 2 } });
        }

        const preloadIds = new Set<string>();

        const heroId = typeof heroConfig?.id === 'string' ? heroConfig.id : '';
        const castleId = typeof castleConfig?.id === 'string' ? castleConfig.id : '';
        if (heroId) preloadIds.add(heroId);
        if (castleId) preloadIds.add(castleId);
        preloadIds.add('ArrowTower');
        preloadIds.add('MagicTower');

        if (rawWaves && rawWaves.length > 0) {
            for (const wv of rawWaves) {
                const groups: any[] = Array.isArray(wv?.groups) ? wv.groups : [];
                for (const g of groups) {
                    const enemyId = typeof g.enemyId === 'string' ? g.enemyId.trim() : '';
                    if (enemyId) preloadIds.add(enemyId);
                }
            }
        } else {
            const fallbackEnemyId = typeof enemyConfig?.id === 'string' ? enemyConfig.id : '';
            if (fallbackEnemyId) preloadIds.add(fallbackEnemyId);
        }

        await Promise.all(Array.from(preloadIds).map(id => EntityConfigCache.loadEntityConfig(id).catch(() => undefined)));

        console.log(`[GameMain] Loaded level: ${levelResourcePathNoExt} grid=${gridW}x${gridH} cellSize=${cellSize}`);
    }

    update(deltaTime: number) {
        this.debugCommandBus?.flush();
        this.updateDebugLabel();
        this.updateDebugDamagePopups(deltaTime);

        if (this.isPaused || GameSession.instance.isGameOver) {
            this.renderWhilePaused();
            return;
        }

        this.updateWaveSpawns(deltaTime);
        this.checkGameOver();
        if (this.world) this.world.update(deltaTime);

        // 更新 HUD 显示
        this.updateHUDDisplay();
    }

    private updateHUDDisplay(): void {
        if (!this.hudManager || !this.playerEntity) return;

        // 更新波次显示（分数格式）
        const currentWave = GameSession.instance.currentWave;
        this.hudManager.displayWave(currentWave, this.maxWaves);

        // 更新英雄血量条
        const healthComponent = this.playerEntity.getComponent(HealthComponent);
        if (healthComponent) {
            this.hudManager.updateHealthBar(healthComponent.current, healthComponent.max);
        }

        // 更新英雄经验条
        const expComponent = this.playerEntity.getComponent(ExperienceComponent);
        const levelComponent = this.playerEntity.getComponent(LevelComponent);
        if (expComponent && levelComponent) {
            const currentLevel = Math.floor(levelComponent.level);
            const expForCurrentLevel = expComponent.getRequiredExpForLevel(currentLevel);
            const expForNextLevel = expComponent.getRequiredExpForLevel(currentLevel + 1);
            const expInCurrentLevel = expComponent.currentExp - expForCurrentLevel;
            const expNeededForNextLevel = Math.max(1, expForNextLevel - expForCurrentLevel);
            this.hudManager.updateExperienceBar(expInCurrentLevel, expNeededForNextLevel);
        }

        // 更新金币显示
        this.hudManager.displayCoin(this.currencySystem.getGold());
    }

    private checkGameOver(): void {
        if (GameSession.instance.isGameOver || this.baseEntityId === null) return;
        const base = this.world.getEntity(this.baseEntityId);
        const hp = base?.getComponent(HealthComponent);
        if (hp && hp.isDead) {
            GameSession.instance.triggerGameOver('主塔已被摧毁');
            this.isPaused = true;
        }
    }

    private tryUpgradeCastle(): boolean {
        if (GameSession.instance.isGameOver || this.baseEntityId === null) return false;
        const base = this.world.getEntity(this.baseEntityId);
        const level = base?.getComponent(LevelComponent);
        if (!base || !level) return false;
        const next = Math.floor(level.level) + 1;
        if (next > 5) return false;
        const cost = CASTLE_UPGRADE_COSTS[next - 1] ?? 0;
        if (!this.currencySystem.spend(cost)) return false;
        level.level = next;
        return true;
    }

    private async tryBuildTower(slotIndex: number, configId: string): Promise<void> {
        if (GameSession.instance.isGameOver) return;
        await EntityConfigCache.loadEntityConfig(configId);
        await this.towerManager.buildTower(this.world, this.currencySystem, slotIndex, configId);
    }

    private tryUpgradeSelectedTower(): boolean {
        const slot = this.towerManager.getSlot(this.selectedTowerSlot);
        if (!slot?.entityId) return false;
        return this.towerManager.upgradeTower(this.world, this.currencySystem, slot.entityId);
    }

    private trySellSelectedTower(): boolean {
        return this.towerManager.sellTower(this.world, this.currencySystem, this.selectedTowerSlot) > 0;
    }

    private restartGame(): void {
        director.loadScene('GameScene');
    }

    private updateWaveSpawns(deltaTime: number): void {
        if (!this.world) return;
        if (!this.actionSystem) return;
        this.levelTimeSeconds += deltaTime;

        if (this.waveSpawner && this.spawnQueue.length > 0) {
            this.waveSpawner.ensureAhead(this.spawnQueue, this.levelTimeSeconds, 90);
        }

        while (this.spawnQueue.length > 0 && this.spawnQueue[0].time <= this.levelTimeSeconds) {
            const ev = this.spawnQueue.shift()!;
            const wave = ev.wave ?? this.currentSpawnWave;
            if (wave !== this.currentSpawnWave) {
                this.currentSpawnWave = wave;
                GameSession.instance.setWave(wave);
            }

            const cfg = EntityConfigCache.get(ev.enemyId);
            if (!cfg) continue;
            const pts = this.levelPaths.get(ev.pathId) ?? null;
            if (!pts || pts.length === 0) continue;
            const spawnPos = pts[0];
            const enemy = EntityFactory.createEntityFromConfig(this.world, cfg, spawnPos);
            enemy.name = `${ev.enemyId}_${enemy.id}`;
            this.scaleEnemyForWave(enemy, wave);
            const follow = this.world.acquireComponent(PathFollowComponent);
            follow.points = pts;
            follow.nextIndex = 0;
            follow.threshold = 6;
            follow.attackBaseAtEnd = true;
            enemy.addComponent(follow);
        }
    }

    private getWaveMultiplier(wave: number): number {
        const w = Math.max(1, Math.floor(wave));
        if (w <= 20) {
            return Math.pow(1.07, w - 1);
        } else if (w <= 40) {
            const base20 = Math.pow(1.07, 19);
            return base20 * Math.pow(1.09, w - 20);
        } else if (w <= 60) {
            const base40 = Math.pow(1.07, 19) * Math.pow(1.09, 20);
            return base40 * Math.pow(1.10, w - 40);
        } else if (w <= 80) {
            const base60 = Math.pow(1.07, 19) * Math.pow(1.09, 20) * Math.pow(1.10, 20);
            return base60 * Math.pow(1.08, w - 60);
        } else {
            const base80 = Math.pow(1.07, 19) * Math.pow(1.09, 20) * Math.pow(1.10, 20) * Math.pow(1.08, 20);
            return base80 * Math.pow(1.06, w - 80);
        }
    }

    private scaleEnemyForWave(enemy: Entity, wave: number): void {
        const w = Math.max(1, Math.floor(wave));
        const multiplier = this.getWaveMultiplier(w);

        const health = enemy.getComponent(HealthComponent);
        if (health) {
            health.max = Math.floor(health.max * multiplier);
            health.current = health.max;
        }
        const defense = enemy.getComponent(DefenseComponent);
        if (defense) {
            defense.defense = Math.floor(defense.defense * multiplier);
            defense.magicResist = Math.floor(defense.magicResist * multiplier);
        }
        const loot = enemy.getComponent(LootComponent);
        if (loot) {
            loot.gold = Math.floor(loot.gold * multiplier);
        }
    }

    onDestroy() {
        this.playerMoveInput?.disable();
        this.debugInput?.disable();
        this.debugCommandBus?.clear();
        this.debugInput = null;
        this.debugCommandBus = null;
        this.playerMoveInput = null;
        this.playerControlSystem = null;
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
        const gold = this.currencySystem ? Math.floor(this.currencySystem.getGold()) : 0;
        this.debugLabel.string = `Gold: ${gold}\nSelected: ${ent.name} #${ent.id} [${factionName}]\nSelfId: ${ent.id}\nHP: ${hp}\nEnemyIds: ${enemyIds || '-'}\nFOV: ${fov}\nGoal: ${goalId}${goalType ? ` (${goalType})` : ''}\nTarget: ${targetId === null ? 'None' : `#${targetId}`} ${targetPos}\n${paused}`;

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
