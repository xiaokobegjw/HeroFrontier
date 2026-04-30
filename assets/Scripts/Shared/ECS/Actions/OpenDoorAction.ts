import { Action } from './Action';
import { ActionResult } from './ActionResult';
import { Entity } from '../Core/Entity';

/**
 * 开门动作
 */
export class OpenDoorAction extends Action {
    constructor(actor: Entity, door: Entity) {
        super(actor, door);
    }

    public perform(deltaTime: number): ActionResult {
        if (!this.target) {
            return ActionResult.FAILURE("No door specified");
        }
        
        // 基础逻辑占位
        return ActionResult.SUCCESS("Opening door");
    }
}
