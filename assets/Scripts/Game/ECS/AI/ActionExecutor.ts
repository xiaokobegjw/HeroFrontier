import { ActionSystem } from '../../../Shared/ECS/Systems/ActionSystem';
import { Entity } from '../../../Shared/ECS/Core/Entity';
import { WalkAction } from '../../../Shared/ECS/Actions/WalkAction';
import { AIComponent } from '../Components/AIComponent';
import { ActionRequest } from './AITypes';
import { World } from '../../../Shared/ECS/Core/World';
import { NavigationSystem } from '../Systems/NavigationSystem';
import { TransformComponent } from '../../../Shared/ECS/Components/TransformComponent';
import { PathWalkAction } from '../../../Shared/ECS/Actions/PathWalkAction';

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
            const changed =
                !ai.hasLastMoveGoal ||
                Math.abs(ai.lastMoveGoalX - req.x) > 2 ||
                Math.abs(ai.lastMoveGoalY - req.y) > 2;

            if (!changed) return;

            ai.hasLastMoveGoal = true;
            ai.lastMoveGoalX = req.x;
            ai.lastMoveGoalY = req.y;

            const nav = this.world.getSystem(NavigationSystem);
            const transform = entity.getComponent(TransformComponent);
            const path = nav && transform ? nav.findPath({ x: transform.x, y: transform.y }, { x: req.x, y: req.y }) : [];

            const current = this.actionSystem.getCurrentAction(entity);
            if (current instanceof PathWalkAction) {
                if (path.length > 0) current.setPath(path);
                else this.actionSystem.setSingleAction(entity, new WalkAction(entity, { x: req.x, y: req.y }));
                return;
            }
            if (current instanceof WalkAction) {
                if (path.length > 0) {
                    this.actionSystem.setSingleAction(entity, new PathWalkAction(entity, path));
                    return;
                }
                current.setTarget({ x: req.x, y: req.y });
                return;
            }

            if (path.length > 0) {
                this.actionSystem.setSingleAction(entity, new PathWalkAction(entity, path));
            } else {
                this.actionSystem.setSingleAction(entity, new WalkAction(entity, { x: req.x, y: req.y }));
            }
        }
    }
}
