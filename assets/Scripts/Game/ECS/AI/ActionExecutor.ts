import { ActionSystem } from '../../../Shared/ECS/Systems/ActionSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { WalkAction } from '../../../Shared/ECS/Actions/WalkAction';
import { AIComponent } from '../Components/AIComponent';
import { ActionRequest } from './AITypes';
import { World } from '../../../Shared/ECS/Core/World';
import { MoveStatsComponent } from '../Components/MoveStatsComponent';
import { GameConfigManager } from '../../../Shared/Managers/GameConfigManager';
import { DebugState } from '../../Debug/DebugState';

export class ActionExecutor {
    private actionSystem: ActionSystem;
    private world: World;

    constructor(actionSystem: ActionSystem, world: World) {
        this.actionSystem = actionSystem;
        this.world = world;
    }

    public apply(entity: Entity, ai: AIComponent, req: ActionRequest): void {
        if (req.type === 'None') return;

        if (req.type === 'Stop') {
            this.actionSystem.clearActions(entity);
            ai.hasLastMoveGoal = false;
            return;
        }

        if (req.type === 'MoveTo') {

            if (GameConfigManager.instance.isPC && GameConfigManager.instance.isDebug) {
                if(entity.id === DebugState.selectedEntityId)
                {
                    let adsfasd = 0;
                    adsfasd++;
                    void adsfasd;
                }
            }

            const changed =
                !ai.hasLastMoveGoal ||
                Math.abs(ai.lastMoveGoalX - req.x) > 2 ||
                Math.abs(ai.lastMoveGoalY - req.y) > 2;

            if (!changed) return;

            ai.hasLastMoveGoal = true;
            ai.lastMoveGoalX = req.x;
            ai.lastMoveGoalY = req.y;

            const current = this.actionSystem.getCurrentAction(entity);
            if (current instanceof WalkAction) {
                current.setTarget({ x: req.x, y: req.y });
                return;
            }

            const move = entity.getComponent(MoveStatsComponent);
            const opts = move ? { maxSpeed: move.maxSpeed, accel: move.accel, decel: move.decel, threshold: move.threshold } : undefined;
            this.actionSystem.setSingleAction(entity, new WalkAction(entity, { x: req.x, y: req.y }, opts));
        }
    }
}
