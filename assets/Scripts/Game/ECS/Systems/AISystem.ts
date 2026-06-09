import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { World } from '../../../Shared/ECS/Core/World';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { TargetComponent } from '../Components/TargetComponent';
import { EquipmentComponent } from '../Components/EquipmentComponent';
import { WeaponComponent } from '../Components/WeaponComponent';
import { AIComponent, GoalSpec } from '../Components/AIComponent';
import { GoalRegistry } from '../AI/GoalRegistry';
import { GoalContext } from '../AI/AITypes';
import { ActionExecutor } from '../AI/ActionExecutor';
import { ActionSystem } from '../../../Shared/ECS/Systems/ActionSystem';
import { HealthComponent } from '../Components/HealthComponent';
import { FactionComponent } from '../Components/FactionComponent';
import { FactionType } from '../../Data/Faction';
import { SoldierComponent } from '../Components/SoldierComponent';
import { StunComponent } from '../../../Shared/ECS/Components/StunComponent';
import { GameConfigManager } from '../../../Shared/Managers/GameConfigManager';
import { DebugState } from '../../Debug/DebugState';

export class AISystem extends ECSSystem {
    private world: World;
    private registry: GoalRegistry;
    private executor: ActionExecutor;

    constructor(world: World, actionSystem: ActionSystem, priority: number = 6.2) {
        super('AISystem', priority);
        this.world = world;
        this.registry = new GoalRegistry();
        this.executor = new ActionExecutor(actionSystem, world);
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [AIComponent, TransformComponent, TargetComponent];
    }

    public update(entities: Entity[], deltaTime: number): void {
        for (const entity of entities) {
            const ai = entity.getComponent(AIComponent);
            const transform = entity.getComponent(TransformComponent);
            const target = entity.getComponent(TargetComponent);

            if (GameConfigManager.instance.isPC && GameConfigManager.instance.isDebug) {
                if(entity.id === DebugState.selectedEntityId)
                {
                    let adsfasd = 0;
                    adsfasd++;
                    void adsfasd;
                }
            }
                
            if (!ai || !transform || !target) continue;
            if (!ai.enabled) continue;

            const faction = entity.getComponent(FactionComponent);
            ai.debugRole =
                faction?.faction === FactionType.Player ? 'Hero' : faction?.faction === FactionType.Enemy ? 'Enemy' : 'Neutral';

            const health = entity.getComponent(HealthComponent);
            if (health && health.isDead) continue;

            // 检查眩晕状态，如果被眩晕则跳过 AI 处理
            const stun = entity.getComponent(StunComponent);
            if (stun && stun.remainingSeconds > 0) continue;

            const soldier = entity.getComponent(SoldierComponent);
            if (soldier && !soldier.deployed) continue;

            if (GameConfigManager.instance.isPC && GameConfigManager.instance.isDebug) {
                if(entity.id === DebugState.selectedEntityId)
                {
                    let adsfasd = 0;
                    adsfasd++;
                    void adsfasd;
                }
            }

            ai.timeSinceRepath += deltaTime;
            if (ai.holdRemaining > 0) ai.holdRemaining -= deltaTime;

            const ctx = this.buildContext(entity, transform, target);
            const chosen = this.chooseGoal(entity, ai, ctx);
            if (!chosen) continue;

            const handler = this.registry.get(chosen.type);
            if (!handler) continue;

            const req = handler.build(this.world, entity, ai, chosen, ctx);
            this.executor.apply(entity, ai, req);
        }
    }

    private buildContext(entity: Entity, transform: TransformComponent, target: TargetComponent): GoalContext {
        const weaponRange = this.resolveWeaponRange(entity);
        const targetPos = this.resolveTargetPos(target);
        return {
            selfId: entity.id,
            selfPos: { x: transform.x, y: transform.y },
            targetId: target.targetEntityId,
            targetPos,
            weaponRange
        };
    }

    private resolveWeaponRange(owner: Entity): number {
        const equip = owner.getComponent(EquipmentComponent);
        if (equip && equip.weaponEntityIds && equip.weaponEntityIds.length > 0) {
            let best = 0;
            for (const id of equip.weaponEntityIds) {
                const weaponEntity = this.world.getEntity(id);
                const weapon = weaponEntity?.getComponent(WeaponComponent) ?? null;
                if (!weapon) continue;
                if (weapon.range > best) best = weapon.range;
            }
            return best;
        }
        if (equip && equip.weaponEntityId !== null) {
            const weaponEntity = this.world.getEntity(equip.weaponEntityId);
            const weapon = weaponEntity?.getComponent(WeaponComponent) ?? null;
            if (weapon) return weapon.range ?? 0;
        }
        return owner.getComponent(WeaponComponent)?.range ?? 0;
    }

    private resolveTargetPos(target: TargetComponent): { x: number; y: number } | null {
        if (target.targetEntityId !== null) {
            const ent = this.world.getEntity(target.targetEntityId);
            const t = ent?.getComponent(TransformComponent);
            if (t) return { x: t.x, y: t.y };
        }
        if (Number.isFinite(target.targetX) && Number.isFinite(target.targetY)) {
            return { x: target.targetX, y: target.targetY };
        }
        return null;
    }

    private chooseGoal(entity: Entity, ai: AIComponent, ctx: GoalContext): GoalSpec | null {
        if (!ai.goals || ai.goals.length === 0) return null;


        let best: GoalSpec | null = null;
        let bestScore = -Infinity;
        let current: GoalSpec | null = null;

        for (const g of ai.goals) {
            if (g.id === ai.activeGoalId) current = g;
            const handler = this.registry.get(g.type);
            if (!handler) continue;
            const s = handler.score(this.world, entity, ai, g, ctx);
            if (s > bestScore) {
                bestScore = s;
                best = g;
            }
        }

        if (!best) return null;

        if (ai.holdRemaining > 0 && current) return current;

        if (current && current.id !== best.id) {
            const currentHandler = this.registry.get(current.type);
            const currentScore = currentHandler ? currentHandler.score(this.world, entity, ai, current, ctx) : 0;
            const hysteresis = typeof best.hysteresis === 'number' ? best.hysteresis : 0.15;
            if (bestScore < currentScore * (1 + hysteresis)) {
                return current;
            }
        }

        if (best.id !== ai.activeGoalId) {
            ai.activeGoalId = best.id;
            const hold = typeof best.minHoldSeconds === 'number' ? best.minHoldSeconds : 0.1;
            ai.holdRemaining = Math.max(0, hold);
        }

        return best;
    }
}
