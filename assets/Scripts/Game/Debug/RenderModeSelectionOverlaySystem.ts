import { Color } from 'cc';
import { ECSSystem } from '../../Shared/ECS/Core/ECSSystem';
import { World } from '../../Shared/ECS/Core/World';
import { Entity } from '../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../Shared/ECS/Core/ECSComponent';
import { IGraphicsContext } from '../../Shared/ECS/Systems/RenderSystem';
import { TransformComponent } from '../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../Shared/ECS/Components/ColliderComponent';
import { TargetComponent } from '../ECS/Components/TargetComponent';
import { PerceptionComponent } from '../ECS/Components/PerceptionComponent';

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

        this.drawSelectedRadiusAndOverlays(ctx);
        this.drawClickMarker(ctx);
    }

    private drawSelectedRadiusAndOverlays(ctx: IGraphicsContext): void {
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

        const perception = ent.getComponent(PerceptionComponent);
        if (perception && perception.viewRange > 0) {
            ctx.strokeColor = new Color(0, 200, 255, 140);
            ctx.lineWidth = 2;
            ctx.circle(tr.x, tr.y, Math.max(1, perception.viewRange));
            ctx.stroke();
        }

        const target = ent.getComponent(TargetComponent);
        if (target) {
            let tx = target.targetX;
            let ty = target.targetY;
            if (target.targetEntityId !== null) {
                const tEnt = this.world.getEntity(target.targetEntityId);
                const tTr = tEnt?.getComponent(TransformComponent);
                const tCol = tEnt?.getComponent(ColliderComponent);
                if (tTr) {
                    tx = tTr.x + (tCol?.offsetX ?? 0);
                    ty = tTr.y + (tCol?.offsetY ?? 0);
                }
            }
            if (Number.isFinite(tx) && Number.isFinite(ty)) {
                ctx.strokeColor = new Color(255, 80, 80, 230);
                ctx.lineWidth = 2;
                ctx.moveTo(cx, cy);
                ctx.lineTo(tx, ty);
                ctx.stroke();

                ctx.strokeColor = new Color(255, 80, 80, 200);
                ctx.lineWidth = 2;
                ctx.circle(tx, ty, 6);
                ctx.stroke();
            }
        }
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
