import { Color } from 'cc';
import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { ColliderComponent, ColliderShapeType } from '../../../Shared/ECS/Components/ColliderComponent';
import { IGraphicsContext } from '../../../Shared/ECS/Systems/RenderSystem';
import { TowerComponent } from '../Components/TowerComponent';
import { PerceptionComponent } from '../Components/PerceptionComponent';
import { WeaponComponent } from '../Components/WeaponComponent';
import { WeaponStateComponent } from '../Components/WeaponStateComponent';
import { TargetComponent } from '../Components/TargetComponent';

export class TowerInfoOverlaySystem extends ECSSystem {
    private world: World;
    private ctx: IGraphicsContext | null = null;
    private getSelectedEntityId: () => number | null;

    constructor(world: World, getSelectedEntityId: () => number | null, priority: number = 101.15) {
        super('TowerInfoOverlaySystem', priority);
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
        void entities;
        void deltaTime;
        if (!this.ctx) return;
        const ctx = this.ctx;
        ctx.clear();

        const selectedId = this.getSelectedEntityId();
        if (selectedId === null) return;
        const ent = this.world.getEntity(selectedId);
        if (!ent || !ent.active) return;
        if (!ent.hasComponent(TowerComponent)) return;

        const tr = ent.getComponent(TransformComponent);
        const col = ent.getComponent(ColliderComponent);
        if (!tr || !col) return;

        const cx = tr.x + (col.offsetX ?? 0);
        const cy = tr.y + (col.offsetY ?? 0);

        const weapon = ent.getComponent(WeaponComponent);
        const perception = ent.getComponent(PerceptionComponent);
        const target = ent.getComponent(TargetComponent);
        const state = ent.getComponent(WeaponStateComponent);

        const range = weapon?.range ?? 0;
        const viewRange = perception?.viewRange ?? 0;

        if (viewRange > 0) {
            ctx.strokeColor = new Color(80, 200, 255, 140);
            ctx.lineWidth = 2;
            ctx.circle(cx, cy, viewRange);
            ctx.stroke();
        }

        if (range > 0) {
            ctx.strokeColor = new Color(255, 220, 80, 160);
            ctx.lineWidth = 2;
            ctx.circle(cx, cy, range);
            ctx.stroke();
        }

        if (target?.targetEntityId !== null) {
            const tEnt = this.world.getEntity(target.targetEntityId);
            const tt = tEnt?.getComponent(TransformComponent);
            const tc = tEnt?.getComponent(ColliderComponent);
            if (tEnt && tt && tc) {
                const tx = tt.x + (tc.offsetX ?? 0);
                const ty = tt.y + (tc.offsetY ?? 0);
                ctx.strokeColor = new Color(255, 80, 80, 200);
                ctx.lineWidth = 2;
                ctx.moveTo(cx, cy);
                ctx.lineTo(tx, ty);
                ctx.stroke();
                ctx.fillColor = new Color(255, 80, 80, 220);
                ctx.circle(tx, ty, 4);
                ctx.fill();
            }
        }

        const cd = state?.cooldownRemaining ?? 0;
        const ar = state?.attackAnimRemaining ?? 0;
        void cd;
        void ar;
    }
}

