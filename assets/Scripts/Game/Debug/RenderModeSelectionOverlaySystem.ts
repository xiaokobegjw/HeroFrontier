import { Color } from 'cc';
import { ECSSystem } from '../../Shared/ECS/Core/ECSSystem';
import { World } from '../../Shared/ECS/Core/World';
import { Entity } from '../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../Shared/ECS/Core/ECSComponent';
import { IGraphicsContext } from '../../Shared/ECS/Systems/RenderSystem';
import { TransformComponent } from '../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../Shared/ECS/Components/ColliderComponent';

type ClickMarker = { x: number; y: number; ttl: number; maxTtl: number } | null;

export class RenderModeSelectionOverlaySystem extends ECSSystem {
    private world: World;
    private ctx: IGraphicsContext | null = null;
    private getSelectedEntityId: () => number | null;
    private getClickMarker: () => ClickMarker;
    private enabled: boolean = false;

    constructor(
        world: World,
        getSelectedEntityId: () => number | null,
        getClickMarker: () => ClickMarker,
        priority: number = 103
    ) {
        super('RenderModeSelectionOverlaySystem', priority);
        this.world = world;
        this.getSelectedEntityId = getSelectedEntityId;
        this.getClickMarker = getClickMarker;
    }

    public setContext(ctx: IGraphicsContext): void {
        this.ctx = ctx;
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) this.ctx?.clear();
    }

    public clear(): void {
        this.ctx?.clear();
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [];
    }

    public update(entities: Entity[], deltaTime: number): void {
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.clear();
        if (!this.enabled) return;

        this.drawSelectedRadius(ctx);
        this.drawClickMarker(ctx);
    }

    private drawSelectedRadius(ctx: IGraphicsContext): void {
        const id = this.getSelectedEntityId();
        if (id === null) return;
        const ent = this.world.getEntity(id);
        if (!ent || !ent.active) return;

        const tr = ent.getComponent(TransformComponent);
        const col = ent.getComponent(ColliderComponent);
        if (!tr || !col) return;

        const cx = tr.x + col.offsetX;
        const cy = tr.y + col.offsetY;
        const r =
            col.shape === ColliderShapeType.Circle
                ? Math.max(0, col.radius)
                : Math.sqrt(Math.pow(col.width * 0.5, 2) + Math.pow(col.height * 0.5, 2));

        ctx.strokeColor = new Color(0, 255, 255, 240);
        ctx.lineWidth = 3;
        ctx.circle(cx, cy, Math.max(1, r));
        ctx.stroke();
    }

    private drawClickMarker(ctx: IGraphicsContext): void {
        const marker = this.getClickMarker();
        if (!marker) return;
        if (marker.ttl <= 0 || marker.maxTtl <= 0) return;

        const t = Math.max(0, Math.min(1, marker.ttl / marker.maxTtl));
        const a = Math.floor(255 * t);

        ctx.strokeColor = new Color(255, 255, 255, a);
        ctx.lineWidth = 2;
        ctx.circle(marker.x, marker.y, 8);
        ctx.stroke();
    }
}

