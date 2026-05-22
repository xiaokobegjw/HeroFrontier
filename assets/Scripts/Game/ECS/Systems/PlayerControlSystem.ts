import { ECSSystem } from '../../../Shared/ECS/Core/ECSSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { World } from '../../../Shared/ECS/Core/World';
import { ActionSystem } from '../../../Shared/ECS/Systems/ActionSystem';
import { WalkAction } from '../../../Shared/ECS/Actions/WalkAction';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { MoveStatsComponent } from '../Components/MoveStatsComponent';
import { HealthComponent } from '../Components/HealthComponent';
import { AIComponent } from '../Components/AIComponent';
import { PlayerMoveInputAdapter } from '../../Input/PlayerMoveInputAdapter';

export class PlayerControlSystem extends ECSSystem {
    private world: World;
    private actionSystem: ActionSystem;
    private input: PlayerMoveInputAdapter;
    private getPlayerEntityId: () => number | null;

    constructor(
        world: World,
        actionSystem: ActionSystem,
        input: PlayerMoveInputAdapter,
        getPlayerEntityId: () => number | null,
        priority: number = 6.3
    ) {
        super('PlayerControlSystem', priority);
        this.world = world;
        this.actionSystem = actionSystem;
        this.input = input;
        this.getPlayerEntityId = getPlayerEntityId;
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [];
    }

    public update(entities: Entity[], deltaTime: number): void {
        const playerId = this.getPlayerEntityId();
        if (playerId === null) return;

        const player = this.world.getEntity(playerId);
        const transform = player?.getComponent(TransformComponent);
        const move = player?.getComponent(MoveStatsComponent);
        const health = player?.getComponent(HealthComponent);
        const ai = player?.getComponent(AIComponent);
        if (!player || !transform || !move) return;
        if (health?.isDead) {
            this.actionSystem.clearActions(player);
            return;
        }

        if (ai && ai.enabled) {
            ai.enabled = false;
            ai.activeGoalId = '';
            ai.holdRemaining = 0;
            ai.hasLastMoveGoal = false;
        }

        const dir = this.input.getDirection();
        if (Math.abs(dir.x) < 0.0001 && Math.abs(dir.y) < 0.0001) {
            this.actionSystem.clearActions(player);
            return;
        }

        const targetDistance = Math.max(64, move.maxSpeed * 0.5);
        const tx = transform.x + dir.x * targetDistance;
        const ty = transform.y + dir.y * targetDistance;
        const opts = {
            maxSpeed: move.maxSpeed,
            accel: move.accel,
            decel: move.decel,
            threshold: Math.max(0.01, move.threshold * 0.25)
        };

        const current = this.actionSystem.getCurrentAction(player);
        if (current instanceof WalkAction) {
            current.setTarget({ x: tx, y: ty });
            return;
        }

        this.actionSystem.setSingleAction(player, new WalkAction(player, { x: tx, y: ty }, opts));
    }
}

