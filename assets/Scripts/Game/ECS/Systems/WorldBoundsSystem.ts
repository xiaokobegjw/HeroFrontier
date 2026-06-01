import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { ObstacleComponent } from '../Components/ObstacleComponent';

export class WorldBoundsSystem extends ECSSystem {
    private minX: number = -1000;
    private maxX: number = 1000;
    private minY: number = -1000;
    private maxY: number = 1000;

    constructor(priority: number = 4.87) {
        super('WorldBoundsSystem', priority);
    }

    public setBounds(minX: number, maxX: number, minY: number, maxY: number): void {
        if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) return;
        if (maxX <= minX || maxY <= minY) return;
        this.minX = minX;
        this.maxX = maxX;
        this.minY = minY;
        this.maxY = maxY;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [TransformComponent, ColliderComponent, HealthComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        void deltaTime;
        for (const e of entities) {
            if (!e.active) continue;
            if (e.hasComponent(ObstacleComponent)) continue;
            const hp = e.getComponent(HealthComponent);
            if (!hp || hp.isDead) continue;
            const tr = e.getComponent(TransformComponent);
            const col = e.getComponent(ColliderComponent);
            if (!tr || !col) continue;

            const ox = col.offsetX ?? 0;
            const oy = col.offsetY ?? 0;

            if (col.shape === ColliderShapeType.Circle) {
                const r = Math.max(0, col.radius);
                const minTx = this.minX + r - ox;
                const maxTx = this.maxX - r - ox;
                const minTy = this.minY + r - oy;
                const maxTy = this.maxY - r - oy;
                tr.x = clamp(tr.x, minTx, maxTx);
                tr.y = clamp(tr.y, minTy, maxTy);
                continue;
            }

            if (col.shape === ColliderShapeType.AABB) {
                const halfW = Math.max(0, col.width) * 0.5;
                const halfH = Math.max(0, col.height) * 0.5;
                const minTx = this.minX + halfW - ox;
                const maxTx = this.maxX - halfW - ox;
                const minTy = this.minY + halfH - oy;
                const maxTy = this.maxY - halfH - oy;
                tr.x = clamp(tr.x, minTx, maxTx);
                tr.y = clamp(tr.y, minTy, maxTy);
                continue;
            }
        }
    }
}

function clamp(v: number, min: number, max: number): number {
    if (min > max) return v;
    return Math.max(min, Math.min(max, v));
}

