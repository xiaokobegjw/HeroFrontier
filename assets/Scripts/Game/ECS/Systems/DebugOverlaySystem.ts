import { Color } from 'cc';
import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { World } from '../../../Shared/ECS/Core/World';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { IGraphicsContext } from '../../../Shared/ECS/Systems/RenderSystem';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { PerceptionComponent } from '../Components/PerceptionComponent';
import { TargetComponent } from '../Components/TargetComponent';
import { AIComponent } from '../Components/AIComponent';

export class DebugOverlaySystem extends ECSSystem {
    private world: World;
    private ctx: IGraphicsContext | null = null;
    private getSelectedEntityId: () => number | null;

    constructor(world: World, getSelectedEntityId: () => number | null, priority: number = 101) {
        super('DebugOverlaySystem', priority);
        this.world = world;
        this.getSelectedEntityId = getSelectedEntityId;
    }

    public setContext(ctx: IGraphicsContext): void {
        this.ctx = ctx;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [];
    }

    public update(entities: Entity[], deltaTime: number): void {
        if (!this.ctx) return;

        const id = this.getSelectedEntityId();
        if (id === null) return;

        const selected = this.world.getEntity(id);
        if (!selected || !selected.active) return;

        const transform = selected.getComponent(TransformComponent);
        if (!transform) return;

        this.drawSelection(transform.x, transform.y);

        const perception = selected.getComponent(PerceptionComponent);
        if (perception) this.drawFov(transform, perception);

        const target = selected.getComponent(TargetComponent);
        if (target) this.drawTargetLine(transform, target);

        const ai = selected.getComponent(AIComponent);
        if (ai) this.drawGoalMarker(transform, ai);
    }

    private drawSelection(x: number, y: number): void {
        const ctx = this.ctx!;
        ctx.strokeColor = new Color(0, 255, 255, 255);
        ctx.lineWidth = 2;
        ctx.circle(x, y, 22);
        ctx.stroke();
    }

    private drawFov(transform: TransformComponent, perception: PerceptionComponent): void {
        const ctx = this.ctx!;
        const range = perception.viewRange;
        const half = (perception.fovDeg * 0.5 * Math.PI) / 180;
        const facing = ((transform.rotation + perception.facingDeg) * Math.PI) / 180;
        const a0 = facing - half;
        const a1 = facing + half;

        ctx.strokeColor = new Color(0, 200, 255, 200);
        ctx.lineWidth = 2;
        ctx.moveTo(transform.x, transform.y);
        ctx.lineTo(transform.x + Math.cos(a0) * range, transform.y + Math.sin(a0) * range);
        ctx.stroke();

        ctx.moveTo(transform.x, transform.y);
        ctx.lineTo(transform.x + Math.cos(a1) * range, transform.y + Math.sin(a1) * range);
        ctx.stroke();

        const segments = 18;
        ctx.strokeColor = new Color(0, 200, 255, 120);
        ctx.lineWidth = 1.5;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const a = a0 + (a1 - a0) * t;
            const px = transform.x + Math.cos(a) * range;
            const py = transform.y + Math.sin(a) * range;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.stroke();
    }

    private drawTargetLine(transform: TransformComponent, target: TargetComponent): void {
        const ctx = this.ctx!;
        let tx = target.targetX;
        let ty = target.targetY;

        if (target.targetEntityId !== null) {
            const ent = this.world.getEntity(target.targetEntityId);
            const t = ent?.getComponent(TransformComponent);
            if (t) {
                tx = t.x;
                ty = t.y;
            }
        }

        if (!Number.isFinite(tx) || !Number.isFinite(ty)) return;

        ctx.strokeColor = new Color(255, 80, 80, 255);
        ctx.lineWidth = 2;
        ctx.moveTo(transform.x, transform.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();

        ctx.strokeColor = new Color(255, 80, 80, 200);
        ctx.lineWidth = 2;
        ctx.circle(tx, ty, 8);
        ctx.stroke();
    }

    private drawGoalMarker(transform: TransformComponent, ai: AIComponent): void {
        const ctx = this.ctx!;
        if (!ai.activeGoalId) return;
        ctx.strokeColor = new Color(255, 255, 255, 180);
        ctx.lineWidth = 2;
        ctx.rect(transform.x - 6, transform.y + 26, 12, 12);
        ctx.stroke();
    }
}

