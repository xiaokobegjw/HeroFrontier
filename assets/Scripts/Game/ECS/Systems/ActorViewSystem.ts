import { Animation, AnimationClip, Node, Prefab, Sprite, UITransform, instantiate, resources } from 'cc';
import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { RenderComponent } from '../../../Shared/ECS/Components/RenderComponent';
import { ViewComponent } from '../Components/ViewComponent';
import { WeaponStateComponent } from '../Components/WeaponStateComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { TargetComponent } from '../Components/TargetComponent';
import { DeathViewEvent, drainDeathViewEvents } from '../GameEvents';
import { LevelComponent } from '../Components/LevelComponent';

type ViewState = {
    node: Node;
    animation: Animation | null;
    currentState: string;
    lastX: number;
    lastY: number;
    facingX: number;
    levelNodes: Node[];
};

type DetachedDeathView = {
    node: Node;
    ttl: number;
};

export class ActorViewSystem extends ECSSystem {
    private world: World;
    private viewRoot: Node;
    private views: Map<number, ViewState> = new Map();
    private pendingLoads: Set<number> = new Set();
    private deathViews: DetachedDeathView[] = [];

    constructor(world: World, viewRoot: Node, priority: number = 99) {
        super('ActorViewSystem', priority);
        this.world = world;
        this.viewRoot = viewRoot;
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

            state.node.setPosition(transform.x + view.offsetX, transform.y + view.offsetY, 0);
            this.updateLevelDamageView(entity, view, state);
            this.updateFacing(entity, transform, state);
            const baseScaleX = Math.max(0.0001, Math.abs(transform.scaleX));
            transform.scaleX = baseScaleX * state.facingX;
            const scaleX = transform.scaleX * view.scale;
            const scaleY = transform.scaleY * view.scale;
            state.node.setScale(scaleX, scaleY, 1);

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

    private async createView(entity: Entity, view: ViewComponent): Promise<void> {
        try {
            const node = await this.instantiateNode(view, entity.name);
            if (!entity.active) {
                node.destroy();
                return;
            }

            this.viewRoot.addChild(node);

            node.getComponent(Sprite) ?? node.addComponent(Sprite);
            const animation = node.getComponent(Animation) ?? node.addComponent(Animation);

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
                const ui = node.getComponent(UITransform) ?? node.addComponent(UITransform);
                ui.setContentSize(32, 48);
            }

            const state: ViewState = {
                node,
                animation,
                currentState: '',
                lastX: Number.NaN,
                lastY: Number.NaN,
                facingX: 1,
                levelNodes: this.resolveLevelNodes(node, view)
            };
            this.views.set(entity.id, state);

            const render = entity.getComponent(RenderComponent);
            if (render) {
                entity.removeComponent(RenderComponent);
            }
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
            state.facingX = transform.scaleX < 0 ? -1 : 1;
            return;
        }
        if (Number.isFinite(state.lastX)) {
            const dx = transform.x - state.lastX;
            if (Math.abs(dx) > 0.01) {
                state.facingX = dx < 0 ? -1 : 1;
                return;
            }
        }

        const targetId = entity.getComponent(TargetComponent)?.targetEntityId ?? null;
        if (targetId !== null) {
            const targetTransform = this.world.getEntity(targetId)?.getComponent(TransformComponent);
            if (targetTransform) {
                const dx = targetTransform.x - transform.x;
                if (Math.abs(dx) > 0.01) state.facingX = dx < 0 ? -1 : 1;
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
        this.viewRoot.addChild(node);
        node.setPosition(ev.x + ev.offsetX, ev.y + ev.offsetY, 0);
        node.setScale(ev.scaleX, ev.scaleY, 1);

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

    private updateLevelDamageView(entity: Entity, view: ViewComponent, state: ViewState): void {
        if (!view.useLevelDamageView || state.levelNodes.length === 0) return;

        const level = Math.max(1, Math.floor(entity.getComponent(LevelComponent)?.level ?? 1));
        const viewIndex = this.resolveCastleViewIndex(level, state.levelNodes.length);
        for (let i = 0; i < state.levelNodes.length; i++) {
            state.levelNodes[i].active = i === viewIndex;
        }

        const health = entity.getComponent(HealthComponent);
        const ratio = health && health.max > 0 ? health.current / health.max : 1;
        const showDamage = ratio <= Math.max(0, Math.min(1, view.damageThresholdPct));
        const activeLevelNode = state.levelNodes[viewIndex] ?? null;
        if (!activeLevelNode) return;

        const normalNode = activeLevelNode.getChildByName(view.normalNodeName);
        const damageNode = activeLevelNode.getChildByName(view.damageNodeName);
        if (normalNode) normalNode.active = !showDamage;
        if (damageNode) damageNode.active = showDamage;
    }

    private resolveCastleViewIndex(level: number, count: number): number {
        if (count <= 1) return 0;
        if (count === 2) return level >= 3 ? 1 : 0;
        if (level <= 1) return 0;
        if (level <= 3) return 1;
        return 2;
    }
}
