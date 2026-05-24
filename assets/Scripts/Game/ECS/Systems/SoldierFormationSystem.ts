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
import { TargetComponent } from '../Components/TargetComponent';
import { garrisonSlotPosition, followerSlotPosition } from '../FormationLayout';

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

            const garrison = soldiers.filter(e => e.getComponent(SoldierComponent)!.mode === 'Garrison');
            const followers = soldiers.filter(e => e.getComponent(SoldierComponent)!.mode === 'Follower');
            const followerTotal = Math.max(1, followers.length);

            for (const ent of soldiers) {
                const soldier = ent.getComponent(SoldierComponent)!;
                const tr = ent.getComponent(TransformComponent)!;
                const target = ent.getComponent(TargetComponent);

                const slot =
                    soldier.mode === 'Garrison'
                        ? garrisonSlotPosition(baseTr.x, baseTr.y, prod, soldier.formationIndex)
                        : heroTr
                          ? followerSlotPosition(heroTr.x, heroTr.y, prod, soldier.formationIndex, followerTotal)
                          : garrisonSlotPosition(baseTr.x, baseTr.y, prod, soldier.formationIndex);

                if (!soldier.deployed) {
                    if (target) {
                        target.targetEntityId = null;
                        target.targetX = Number.NaN;
                        target.targetY = Number.NaN;
                        target.lockedUntilTime = 0;
                    }
                    if (this.moveToward(ent, tr, slot.x, slot.y, true)) {
                        soldier.deployed = true;
                    }
                    continue;
                }

                if (soldier.mode === 'Garrison') {
                    if (target?.targetEntityId !== null) continue;
                    this.moveToward(ent, tr, slot.x, slot.y, false);
                    continue;
                }

                if (soldier.mode === 'Follower') {
                    if (target?.targetEntityId !== null) continue;
                    if (heroTr) this.moveToward(ent, tr, slot.x, slot.y, false);
                }
            }
        }
    }

    /** @returns true 表示已到达阵位 */
    private moveToward(entity: Entity, tr: TransformComponent, tx: number, ty: number, force: boolean): boolean {
        const dx = tx - tr.x;
        const dy = ty - tr.y;
        const distSq = dx * dx + dy * dy;
        const move = entity.getComponent(MoveStatsComponent);
        const threshold = typeof move?.threshold === 'number' ? Math.max(2, move.threshold) : 4;
        if (distSq <= threshold * threshold) return true;

        if (!force && !this.actionSystem.isIdle(entity)) return false;

        const opts = move ? { maxSpeed: move.maxSpeed, accel: move.accel, decel: move.decel, threshold: move.threshold } : undefined;
        const current = this.actionSystem.getCurrentAction(entity);
        if (current instanceof WalkAction) {
            current.setTarget({ x: tx, y: ty });
            return false;
        }
        this.actionSystem.setSingleAction(entity, new WalkAction(entity, { x: tx, y: ty }, opts));
        return false;
    }
}
