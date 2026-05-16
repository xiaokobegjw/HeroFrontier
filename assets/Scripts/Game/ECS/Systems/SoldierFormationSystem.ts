import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { ActionSystem } from '../../../Shared/ECS/Systems/ActionSystem';
import { WalkAction } from '../../../Shared/ECS/Actions/WalkAction';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { MoveStatsComponent } from '../Components/MoveStatsComponent';
import { SoldierComponent } from '../Components/SoldierComponent';
import { BaseProductionComponent } from '../Components/BaseProductionComponent';

export class SoldierFormationSystem extends ECSSystem {
    private world: World;
    private actionSystem: ActionSystem;
    private getHeroEntityId: () => number | null;

    constructor(world: World, actionSystem: ActionSystem, getHeroEntityId: () => number | null, priority: number = 6.05) {
        super('SoldierFormationSystem', priority);
        this.world = world;
        this.actionSystem = actionSystem;
        this.getHeroEntityId = getHeroEntityId;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [SoldierComponent, TransformComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        const heroId = this.getHeroEntityId();
        const heroTr = heroId !== null ? this.world.getEntity(heroId)?.getComponent(TransformComponent) ?? null : null;

        const byBase: Map<number, Entity[]> = new Map();
        for (const e of entities) {
            const s = e.getComponent(SoldierComponent);
            if (!s) continue;
            const list = byBase.get(s.baseEntityId) ?? [];
            list.push(e);
            byBase.set(s.baseEntityId, list);
        }

        for (const [baseId, soldiers] of byBase) {
            const baseEnt = this.world.getEntity(baseId);
            const baseTr = baseEnt?.getComponent(TransformComponent) ?? null;
            const prod = baseEnt?.getComponent(BaseProductionComponent) ?? null;
            if (!baseTr || !prod) continue;

            const garrison = soldiers
                .filter(e => e.getComponent(SoldierComponent)!.mode === 'Garrison')
                .sort((a, b) => a.getComponent(SoldierComponent)!.slotIndex - b.getComponent(SoldierComponent)!.slotIndex);
            const followers = soldiers
                .filter(e => e.getComponent(SoldierComponent)!.mode === 'Follower')
                .sort((a, b) => a.getComponent(SoldierComponent)!.slotIndex - b.getComponent(SoldierComponent)!.slotIndex);

            this.updateGarrison(baseTr.x, baseTr.y, prod, garrison);
            if (heroTr) this.updateFollowers(heroTr.x, heroTr.y, prod, followers);
        }
    }

    private updateGarrison(baseX: number, baseY: number, prod: BaseProductionComponent, garrison: Entity[]): void {
        const rows = Math.max(1, Math.floor(prod.garrisonRows));
        const rowSpacing = prod.garrisonRowSpacing;
        const colSpacing = prod.garrisonColSpacing;
        const startX = baseX - prod.garrisonOffsetX;
        const centerRow = (rows - 1) * 0.5;

        for (let i = 0; i < garrison.length; i++) {
            const ent = garrison[i];
            const tr = ent.getComponent(TransformComponent)!;
            const col = Math.floor(i / rows);
            const row = i - col * rows;
            const tx = startX - col * colSpacing;
            const ty = baseY + (row - centerRow) * rowSpacing;
            this.moveToward(ent, tr, tx, ty);
        }
    }

    private updateFollowers(heroX: number, heroY: number, prod: BaseProductionComponent, followers: Entity[]): void {
        const r = Math.max(8, prod.followerRadius);
        const n = followers.length;
        for (let i = 0; i < followers.length; i++) {
            const ent = followers[i];
            const tr = ent.getComponent(TransformComponent)!;
            const a = (i / Math.max(1, n)) * Math.PI * 2;
            const tx = heroX + Math.cos(a) * r;
            const ty = heroY + Math.sin(a) * r;
            this.moveToward(ent, tr, tx, ty);
        }
    }

    private moveToward(entity: Entity, tr: TransformComponent, tx: number, ty: number): void {
        const dx = tx - tr.x;
        const dy = ty - tr.y;
        const distSq = dx * dx + dy * dy;
        const move = entity.getComponent(MoveStatsComponent);
        const threshold = typeof move?.threshold === 'number' ? Math.max(0.1, move.threshold) : 2;
        if (distSq <= threshold * threshold) return;
        if (!this.actionSystem.isIdle(entity)) return;
        const opts = move ? { maxSpeed: move.maxSpeed, accel: move.accel, decel: move.decel, threshold: move.threshold } : undefined;
        this.actionSystem.setSingleAction(entity, new WalkAction(entity, { x: tx, y: ty }, opts));
    }
}

