import { ActionSystem } from '../../../Shared/ECS/Systems/ActionSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { WalkAction } from '../../../Shared/ECS/Actions/WalkAction';
import { AIComponent } from '../Components/AIComponent';
import { ActionRequest } from './AITypes';

export class ActionExecutor {
    private actionSystem: ActionSystem;

    constructor(actionSystem: ActionSystem) {
        this.actionSystem = actionSystem;
    }

    public apply(entity: Entity, ai: AIComponent, req: ActionRequest): void {
        if (req.type === 'None') return;

        if (req.type === 'Stop') {
            this.actionSystem.clearActions(entity);
            ai.hasLastMoveGoal = false;
            return;
        }

        if (req.type === 'MoveTo') {
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

            this.actionSystem.setSingleAction(entity, new WalkAction(entity, { x: req.x, y: req.y }));
        }
    }
}
