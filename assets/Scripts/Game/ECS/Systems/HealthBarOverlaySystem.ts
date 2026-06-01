import { Color } from 'cc';
import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { IGraphicsContext } from '../../../Shared/ECS/Systems/RenderSystem';
import { HealthComponent } from '../Components/HealthComponent';
import { ObstacleComponent } from '../Components/ObstacleComponent';
import { ViewComponent } from '../Components/ViewComponent';

export class HealthBarOverlaySystem extends ECSSystem {
    private world: World;
    private ctx: IGraphicsContext | null = null;
    private timeSeconds: number = 0;
    private showSeconds: number = 1.8;

    constructor(world: World, priority: number = 101.2) {
        super('HealthBarOverlaySystem', priority);
        this.world = world;
    }

    public setContext(ctx: IGraphicsContext): void {
        this.ctx = ctx;
    }

    public setShowSeconds(seconds: number): void {
        if (!Number.isFinite(seconds)) return;
        this.showSeconds = Math.max(0.05, seconds);
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, HealthComponent, ColliderComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        this.timeSeconds += Math.max(0, deltaTime);
        if (!this.ctx) return;

        const ctx = this.ctx;
        ctx.clear();

        for (const entity of entities) {
            if (!entity.active) continue;
            if (entity.hasComponent(ObstacleComponent)) continue;

            const hp = entity.getComponent(HealthComponent);
            if (!hp || hp.isDead) continue;
            if (!Number.isFinite(hp.lastDamagedTime)) continue;
            const age = this.timeSeconds - hp.lastDamagedTime;
            if (age < 0 || age > this.showSeconds) continue;

            const tr = entity.getComponent(TransformComponent);
            const col = entity.getComponent(ColliderComponent);
            if (!tr || !col) continue;

            const r = approxRadius(col);
            const cx = tr.x + (col.offsetX ?? 0);
            const cy = tr.y + (col.offsetY ?? 0);

            const view = entity.getComponent(ViewComponent);
            const baseY = cy + r + 14 + (view?.offsetY ?? 0);

            const width = clamp(r * 2 + 24, 28, 120);
            const height = clamp(5 + r * 0.08, 5, 8);
            const x = cx - width * 0.5;
            const y = baseY;

            const pct = hp.max > 0 ? clamp(hp.current / hp.max, 0, 1) : 0;
            const fade = clamp(1 - age / this.showSeconds, 0, 1);
            const bgA = Math.floor(150 * fade);
            const fgA = Math.floor(230 * fade);
            const bdA = Math.floor(210 * fade);

            ctx.fillColor = new Color(0, 0, 0, bgA);
            ctx.rect(x, y, width, height);
            ctx.fill();

            const fillW = Math.max(0, width * pct);
            if (fillW > 0) {
                const red = Math.floor(255 * (1 - pct));
                const green = Math.floor(255 * pct);
                ctx.fillColor = new Color(red, green, 50, fgA);
                ctx.rect(x, y, fillW, height);
                ctx.fill();
            }

            ctx.strokeColor = new Color(0, 0, 0, bdA);
            ctx.lineWidth = 1;
            ctx.rect(x, y, width, height);
            ctx.stroke();
        }
    }
}

function approxRadius(c: ColliderComponent): number {
    if (c.shape === ColliderShapeType.Circle) return Math.max(0, c.radius);
    const hw = Math.max(0, c.width) * 0.5;
    const hh = Math.max(0, c.height) * 0.5;
    return Math.sqrt(hw * hw + hh * hh);
}

function clamp(v: number, min: number, max: number): number {
    if (min > max) return v;
    return Math.max(min, Math.min(max, v));
}

