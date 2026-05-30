import { Color } from 'cc';
import { ECSSystem } from '../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../Shared/ECS/Core/Entity';
import { IGraphicsContext } from '../../Shared/ECS/Systems/RenderSystem';
import { CollisionSystem } from '../../Shared/ECS/Systems/CollisionSystem';
import { QuadTree } from '../../Shared/Spatial/QuadTree';

type Bounds = { x: number; y: number; width: number; height: number };

export class QuadTreeDebugDrawSystem extends ECSSystem {
    private ctx: IGraphicsContext | null = null;
    private collision: CollisionSystem;
    private getSelectionTree: () => QuadTree<{ id: number; bounds: Bounds }> | null;
    private enabled: boolean = false;

    constructor(
        collision: CollisionSystem,
        getSelectionTree: () => QuadTree<{ id: number; bounds: Bounds }> | null,
        priority: number = 102
    ) {
        super('QuadTreeDebugDrawSystem', priority);
        this.collision = collision;
        this.getSelectionTree = getSelectionTree;
    }

    public setContext(ctx: IGraphicsContext): void {
        this.ctx = ctx;
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) this.ctx?.clear();
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [];
    }

    public update(entities: Entity[], deltaTime: number): void {
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.clear();
        if (!this.enabled) return;

        this.drawCollisionIndex(ctx);
        this.drawSelectionIndex(ctx);
        this.drawCollisionItems(ctx);
        this.drawSelectionItems(ctx);
    }

    private drawCollisionIndex(ctx: IGraphicsContext): void {
        this.collision.debugTraverseIndex((b, depth, itemCount, divided) => {
            if (itemCount === 0 && !divided) return;
            const a = Math.max(40, 230 - depth * 18);
            ctx.strokeColor = new Color(255, 80, 80, a);
            ctx.lineWidth = depth === 0 ? 3 : 2;
            ctx.rect(b.x, b.y, b.width, b.height);
            ctx.stroke();
        }, false);
    }

    private drawSelectionIndex(ctx: IGraphicsContext): void {
        const tree = this.getSelectionTree();
        if (!tree) return;
        tree.debugTraverse((b, depth, itemCount, divided) => {
            if (itemCount === 0 && !divided) return;
            const a = Math.max(40, 230 - depth * 18);
            ctx.strokeColor = new Color(80, 200, 255, a);
            ctx.lineWidth = depth === 0 ? 3 : 2;
            ctx.rect(b.x, b.y, b.width, b.height);
            ctx.stroke();
        }, false);
    }

    private drawCollisionItems(ctx: IGraphicsContext): void {
        const items = this.collision.debugGetIndexItems();
        if (!items || items.length === 0) return;
        ctx.strokeColor = new Color(255, 120, 120, 240);
        ctx.lineWidth = 2;
        for (const it of items) {
            const b = it.bounds;
            ctx.rect(b.x, b.y, b.width, b.height);
            ctx.stroke();
        }
    }

    private drawSelectionItems(ctx: IGraphicsContext): void {
        const tree = this.getSelectionTree();
        if (!tree) return;
        const items = tree.getAllItems();
        if (!items || items.length === 0) return;
        ctx.strokeColor = new Color(120, 220, 255, 240);
        ctx.lineWidth = 2;
        for (const it of items) {
            const b = it.bounds;
            ctx.rect(b.x, b.y, b.width, b.height);
            ctx.stroke();
        }
    }
}
