import { Action } from './Action';
import { ActionResult } from './ActionResult';
import { Entity } from '../Core/Entity';

/**
 * 使用物品动作
 */
export class UseItemAction extends Action {
    constructor(actor: Entity, item: Entity) {
        super(actor, item);
    }

    public perform(deltaTime: number): ActionResult {
        if (!this.target) {
            return ActionResult.FAILURE("No item specified");
        }
        
        // 基础逻辑占位
        return ActionResult.SUCCESS("Using item");
    }
}
