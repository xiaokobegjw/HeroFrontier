import { Animation, AnimationClip, Node, Prefab, Sprite, UITransform, instantiate, resources } from 'cc';
import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ViewComponent } from '../Components/ViewComponent';
import { WeaponStateComponent } from '../Components/WeaponStateComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { TargetComponent } from '../Components/TargetComponent';
import { DeathViewEvent, drainDeathViewEvents } from '../GameEvents';
import { LevelComponent } from '../Components/LevelComponent';
import { ProjectileComponent } from '../Components/ProjectileComponent';
import { ProjectileSpecComponent } from '../Components/ProjectileSpecComponent';
import { TowerComponent } from '../Components/TowerComponent';

type ViewState = {
    node: Node;
    animation: Animation | null;
    currentState: string;
    lastX: number;
    lastY: number;
    facingX: number;
    levelNodes: Node[];
    activeSoldierNode: Node | null;
    activeAttackNode: Node | null;
    lastLevelViewIndex: number;
    lastShowDamage: boolean;
    lastHpCurrent: number;
    lastHpMax: number;
    levelNormalNodes: (Node | null)[];
    levelDamageNodes: (Node | null)[];
    levelSoldierNodes: (Node | null)[];
    levelAttackNodes: (Node | null)[];
};

type DetachedDeathView = {
    node: Node;
    ttl: number;
};

export class ActorViewSystem extends ECSSystem {
    private world: World;
    private viewRoot: Node;
    private effectRoot: Node;
    private views: Map<number, ViewState> = new Map();
    private pendingLoads: Set<number> = new Set();
    private deathViews: DetachedDeathView[] = [];
    private spriteVisible: boolean = true;

    constructor(world: World, viewRoot: Node, effectRoot: Node | null = null, priority: number = 99) {
        super('ActorViewSystem', priority);
        this.world = world;
        this.viewRoot = viewRoot;
        // 如果没有传入 effectRoot，则回退到 viewRoot
        this.effectRoot = effectRoot ?? viewRoot;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, ViewComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        this.updateDetachedDeathViews(deltaTime);
        const alive = new Set<number>();

        for (const entity of entities) {
            if (!entity.active) continue;
            const transform = entity.getComponent(TransformComponent);
            const view = entity.getComponent(ViewComponent);
            if (!transform || !view) continue;

            alive.add(entity.id);

            const state = this.views.get(entity.id) ?? null;
            if (!state) {
                if (!this.pendingLoads.has(entity.id)) {
                    this.pendingLoads.add(entity.id);
                    this.createView(entity, view);
                }
                continue;
            }

            const isProjectile = entity.hasComponent(ProjectileComponent) || entity.hasComponent(ProjectileSpecComponent);
            const projectileHeight = isProjectile ? (entity.getComponent(ProjectileComponent)?.height ?? 0) : 0;
            state.node.setPosition(transform.x + view.offsetX, transform.y + view.offsetY + projectileHeight, 0);
            this.updateLevelDamageView(entity, view, state);
            if (!isProjectile) {
                this.updateFacing(entity, transform, state);
            }

            // 如果不是塔类实体，直接翻转根节点
            if (!view.useLevelDamageView) {
                const baseScaleX = Math.max(0.0001, Math.abs(transform.scaleX));
                if (!isProjectile) {
                    transform.scaleX = baseScaleX * state.facingX;
                } else {
                    transform.scaleX = baseScaleX;
                }
            } else if (entity.hasComponent(TowerComponent)) {
                // 塔类实体：优先翻转 soldier 节点；如果 prefab 没有 soldier，则回退翻转当前等级节点
                const idx = state.lastLevelViewIndex;
                const levelNode = idx >= 0 && idx < state.levelNodes.length ? state.levelNodes[idx] : null;
                const flipNode = state.activeSoldierNode ?? levelNode;
                if (flipNode) flipNode.setScale(state.facingX, 1, 1);
            }

            if (isProjectile) {
                state.node.setRotationFromEuler(0, 0, transform.rotation);
            } else {
                state.node.setRotationFromEuler(0, 0, 0);
            }

            const scaleX = transform.scaleX * view.scale;
            const scaleY = transform.scaleY * view.scale;
            state.node.setScale(scaleX, scaleY, 1);

            // 更新动态发射点偏移
            if (state.activeAttackNode) {
                // 获取 attackNode 相对于根节点 (state.node) 的位置
                const worldPos = state.activeAttackNode.getWorldPosition();
                const rootSpacePos = state.node.getComponent(UITransform)!.convertToNodeSpaceAR(worldPos);
                view.fireOffsetX = rootSpacePos.x;
                view.fireOffsetY = rootSpacePos.y;
            } else {
                view.fireOffsetX = 0;
                view.fireOffsetY = 0;
            }

            const nextState = this.resolveState(entity, view, transform, state);
            if (state.animation) {
                const clipState = state.animation.getState(nextState);
                const shouldRestart = !!clipState && !clipState.isPlaying && (nextState === view.idleStateName || nextState === view.walkStateName);
                if ((state.currentState !== nextState || shouldRestart) && clipState) {
                    state.animation.play(nextState);
                    state.currentState = nextState;
                }
            }

            state.lastX = transform.x;
            state.lastY = transform.y;
        }

        for (const [entityId, state] of this.views) {
            if (alive.has(entityId)) continue;
            state.node.destroy();
            this.views.delete(entityId);
            this.pendingLoads.delete(entityId);
        }
    }

    public onDestroy(): void {
        for (const [, state] of this.views) {
            state.node.destroy();
        }
        this.views.clear();
        this.pendingLoads.clear();
        for (const entry of this.deathViews) {
            entry.node.destroy();
        }
        this.deathViews = [];
    }

    public setSpriteVisible(visible: boolean): void {
        this.spriteVisible = visible;
        for (const [, state] of this.views) {
            this.applySpriteVisibleToNode(state.node, visible);
        }
        for (const entry of this.deathViews) {
            this.applySpriteVisibleToNode(entry.node, visible);
        }
    }

    private async createView(entity: Entity, view: ViewComponent): Promise<void> {
        try {
            const node = await this.instantiateNode(view, entity.name);
            if (!entity.active) {
                node.destroy();
                return;
            }

            // 根据实体类型选择根节点：子弹和特效挂在 effectRoot，普通单位挂在 viewRoot
            const isProjectile = entity.hasComponent(ProjectileComponent) || entity.hasComponent(ProjectileSpecComponent);
            const isEffect = entity.name.toLowerCase().includes('effect');
            
            const parent = (isProjectile || isEffect) ? this.effectRoot : this.viewRoot;
            parent.addChild(node);

            node.getComponent(Sprite) ?? node.addComponent(Sprite);
            const animation = node.getComponent(Animation) ?? node.addComponent(Animation);
            this.applySpriteVisibleToNode(node, this.spriteVisible);

            if (view.idleClipPath) {
                const idleClip = await this.loadResource<AnimationClip>(view.idleClipPath, AnimationClip);
                if (idleClip) {
                    idleClip.name = view.idleStateName;
                    this.attachClip(animation, idleClip);
                }
            }
            if (view.walkClipPath) {
                const walkClip = await this.loadResource<AnimationClip>(view.walkClipPath, AnimationClip);
                if (walkClip) {
                    walkClip.name = view.walkStateName;
                    this.attachClip(animation, walkClip);
                }
            }
            if (view.attackClipPath) {
                const attackClip = await this.loadResource<AnimationClip>(view.attackClipPath, AnimationClip);
                if (attackClip) {
                    attackClip.name = view.attackStateName;
                    this.attachClip(animation, attackClip);
                }
            }
            if (view.dieClipPath) {
                const dieClip = await this.loadResource<AnimationClip>(view.dieClipPath, AnimationClip);
                if (dieClip) {
                    dieClip.name = view.dieStateName;
                    this.attachClip(animation, dieClip);
                }
            }

            if (!animation.clips || animation.clips.length === 0) {
                const ui = node.getComponent(UITransform);
                if (!ui) {
                    node.addComponent(UITransform).setContentSize(32, 48);
                }
            }

            const levelNodes = this.resolveLevelNodes(node, view);
            const levelCache = this.buildLevelViewCache(levelNodes, view);
            const state: ViewState = {
                node,
                animation,
                currentState: '',
                lastX: Number.NaN,
                lastY: Number.NaN,
                facingX: 1,
                levelNodes,
                activeSoldierNode: null,
                activeAttackNode: null,
                lastLevelViewIndex: -1,
                lastShowDamage: false,
                lastHpCurrent: Number.NaN,
                lastHpMax: Number.NaN,
                levelNormalNodes: levelCache.normalNodes,
                levelDamageNodes: levelCache.damageNodes,
                levelSoldierNodes: levelCache.soldierNodes,
                levelAttackNodes: levelCache.attackNodes
            };
            this.views.set(entity.id, state);
        } catch (err) {
            console.warn('[ActorViewSystem] Failed to create actor view', entity.name, err);
        } finally {
            this.pendingLoads.delete(entity.id);
        }
    }

    private async instantiateNode(view: ViewComponent, name: string): Promise<Node> {
        if (view.prefabPath) {
            const prefab = await this.loadResource<Prefab>(view.prefabPath, Prefab);
            if (prefab) {
                const node = instantiate(prefab);
                node.name = name;
                return node;
            }
        }

        const node = new Node(name);
        node.addComponent(UITransform);
        node.addComponent(Sprite);
        node.addComponent(Animation);
        return node;
    }

    private async loadResource<T>(path: string, type: new (...args: any[]) => T): Promise<T | null> {
        return new Promise((resolve) => {
            resources.load(path, type as any, (err, asset) => {
                if (err || !asset) {
                    console.warn(`[ActorViewSystem] load failed: ${path}`, err);
                    resolve(null);
                    return;
                }
                resolve(asset as T);
            });
        });
    }

    private attachClip(animation: Animation, clip: AnimationClip): void {
        const clips = animation.clips ? animation.clips.slice() : [];
        if (clips.indexOf(clip) === -1) clips.push(clip);
        animation.clips = clips;
        if (!animation.defaultClip) animation.defaultClip = clip;
    }

    private applySpriteVisibleToNode(node: Node, visible: boolean): void {
        const sprites = node.getComponentsInChildren(Sprite);
        for (const sp of sprites) sp.enabled = visible;
    }

    private resolveState(entity: Entity, view: ViewComponent, transform: TransformComponent, state: ViewState): string {
        if (view.useLevelDamageView) return '';
        const health = entity.getComponent(HealthComponent);
        if (health?.isDead) return view.dieStateName;

        const weaponState = entity.getComponent(WeaponStateComponent);
        if (weaponState && weaponState.attackAnimRemaining > 0) return view.attackStateName;

        return this.isMoving(transform, state) ? view.walkStateName : view.idleStateName;
    }

    private updateFacing(entity: Entity, transform: TransformComponent, state: ViewState): void {
        const view = entity.getComponent(ViewComponent);
        if (view?.useLevelDamageView) {
            const targetId = entity.getComponent(TargetComponent)?.targetEntityId ?? null;
            if (targetId !== null) {
                const targetTransform = this.world.getEntity(targetId)?.getComponent(TransformComponent);
                if (targetTransform) {
                    const dx = targetTransform.x - transform.x;
                    if (Math.abs(dx) > 0.5) state.facingX = dx < 0 ? -1 : 1;
                    return;
                }
            }
            state.facingX = transform.scaleX < 0 ? -1 : 1;
            return;
        }
        if (Number.isFinite(state.lastX)) {
            const dx = transform.x - state.lastX;
            // 增加阈值到 0.5，避免微小移动导致朝向频繁翻转
            if (Math.abs(dx) > 0.5) {
                state.facingX = dx < 0 ? -1 : 1;
                return;
            }
        }

        const targetId = entity.getComponent(TargetComponent)?.targetEntityId ?? null;
        if (targetId !== null) {
            const targetTransform = this.world.getEntity(targetId)?.getComponent(TransformComponent);
            if (targetTransform) {
                const dx = targetTransform.x - transform.x;
                // 增加阈值到 0.5，避免微小移动导致朝向频繁翻转
                if (Math.abs(dx) > 0.5) state.facingX = dx < 0 ? -1 : 1;
            }
        }
    }

    private isMoving(transform: TransformComponent, state: ViewState): boolean {
        if (!Number.isFinite(state.lastX) || !Number.isFinite(state.lastY)) return false;
        const dx = transform.x - state.lastX;
        const dy = transform.y - state.lastY;
        return dx * dx + dy * dy > 0.0001;
    }

    private updateDetachedDeathViews(deltaTime: number): void {
        for (const ev of drainDeathViewEvents()) {
            this.spawnDetachedDeathView(ev);
        }

        const remaining: DetachedDeathView[] = [];
        for (const entry of this.deathViews) {
            entry.ttl -= deltaTime;
            if (entry.ttl <= 0) {
                entry.node.destroy();
                continue;
            }
            remaining.push(entry);
        }
        this.deathViews = remaining;
    }

    private async spawnDetachedDeathView(ev: DeathViewEvent): Promise<void> {
        const node = await this.instantiateDetachedNode(ev.prefabPath, 'DeathView');
        this.effectRoot.addChild(node);
        node.setPosition(ev.x + ev.offsetX, ev.y + ev.offsetY, 0);
        node.setScale(ev.scaleX, ev.scaleY, 1);
        this.applySpriteVisibleToNode(node, this.spriteVisible);

        const animation = node.getComponent(Animation) ?? node.addComponent(Animation);
        let ttl = 0.6;
        if (ev.dieClipPath) {
            const dieClip = await this.loadResource<AnimationClip>(ev.dieClipPath, AnimationClip);
            if (dieClip) {
                dieClip.name = ev.dieStateName;
                this.attachClip(animation, dieClip);
                ttl = Math.max(0.2, dieClip.duration || ttl);
                if (animation.getState(ev.dieStateName)) {
                    animation.play(ev.dieStateName);
                }
            }
        }

        this.deathViews.push({ node, ttl });
    }

    private async instantiateDetachedNode(prefabPath: string, name: string): Promise<Node> {
        if (prefabPath) {
            const prefab = await this.loadResource<Prefab>(prefabPath, Prefab);
            if (prefab) {
                const node = instantiate(prefab);
                node.name = name;
                return node;
            }
        }

        const node = new Node(name);
        node.addComponent(UITransform);
        node.addComponent(Sprite);
        node.addComponent(Animation);
        return node;
    }

    private resolveLevelNodes(root: Node, view: ViewComponent): Node[] {
        if (!view.useLevelDamageView || !view.levelNodeNames || view.levelNodeNames.length === 0) return [];
        return view.levelNodeNames
            .map(name => root.getChildByName(name))
            .filter((node): node is Node => !!node);
    }

    private buildLevelViewCache(levelNodes: Node[], view: ViewComponent): {
        normalNodes: (Node | null)[];
        damageNodes: (Node | null)[];
        soldierNodes: (Node | null)[];
        attackNodes: (Node | null)[];
    } {
        const normalNodes: (Node | null)[] = [];
        const damageNodes: (Node | null)[] = [];
        const soldierNodes: (Node | null)[] = [];
        const attackNodes: (Node | null)[] = [];

        for (const levelNode of levelNodes) {
            const normalNode = levelNode.getChildByName(view.normalNodeName) ?? null;
            const damageNode = levelNode.getChildByName(view.damageNodeName) ?? null;
            const soldierNode = levelNode.getChildByName('soldier') ?? null;
            const attackNode = soldierNode?.getChildByName('attackNode') ?? null;
            normalNodes.push(normalNode);
            damageNodes.push(damageNode);
            soldierNodes.push(soldierNode);
            attackNodes.push(attackNode);
        }

        return { normalNodes, damageNodes, soldierNodes, attackNodes };
    }

    private updateLevelDamageView(entity: Entity, view: ViewComponent, state: ViewState): void {
        if (!view.useLevelDamageView || state.levelNodes.length === 0) return;

        const level = Math.max(1, Math.floor(entity.getComponent(LevelComponent)?.level ?? 1));
        const viewIndex = this.resolveLevelViewIndex(entity, level, state.levelNodes.length);
        const health = entity.getComponent(HealthComponent);
        const hpMax = health?.max ?? 0;
        const hpCurrent = health?.current ?? 0;
        const ratio = hpMax > 0 ? hpCurrent / hpMax : 1;
        const showDamage = ratio <= Math.max(0, Math.min(1, view.damageThresholdPct));
        const levelChanged = viewIndex !== state.lastLevelViewIndex;
        const hpChanged = hpCurrent !== state.lastHpCurrent || hpMax !== state.lastHpMax;
        const damageChanged = showDamage !== state.lastShowDamage;
        if (!levelChanged && !hpChanged && !damageChanged) return;

        if (levelChanged) {
            if (state.lastLevelViewIndex >= 0 && state.lastLevelViewIndex < state.levelNodes.length) {
                state.levelNodes[state.lastLevelViewIndex].active = false;
            }
            const next = state.levelNodes[viewIndex] ?? null;
            if (next) {
                next.active = true;
            }
        }

        if (levelChanged || damageChanged) {
            const normalNode = state.levelNormalNodes[viewIndex] ?? null;
            const damageNode = state.levelDamageNodes[viewIndex] ?? null;
            if (normalNode) normalNode.active = !showDamage;
            if (damageNode) damageNode.active = showDamage;
            state.activeSoldierNode = state.levelSoldierNodes[viewIndex] ?? null;
            state.activeAttackNode = state.levelAttackNodes[viewIndex] ?? null;
        }

        state.lastLevelViewIndex = viewIndex;
        state.lastShowDamage = showDamage;
        state.lastHpCurrent = hpCurrent;
        state.lastHpMax = hpMax;
    }

    private resolveLevelViewIndex(entity: Entity, level: number, count: number): number {
        // 如果是城堡 (Base)，保持原有的特殊逻辑 (3级进化)
        if (entity.name === 'Base' || entity.name.includes('Castle')) {
            if (count <= 1) return 0;
            if (count === 2) return level >= 3 ? 1 : 0;
            if (level <= 1) return 0;
            if (level <= 3) return 1;
            return 2;
        }

        // 对于塔或其他多级单位，采用 1:1 映射 (Level 1 -> Index 0)
        return Math.max(0, Math.min(level - 1, count - 1));
    }
}
