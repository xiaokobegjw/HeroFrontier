import { Action } from './Action';
import { ActionResult } from './ActionResult';
import { Entity } from '../Core/Entity';

/**
 * 攻击动作
 */
export class AttackAction extends Action {
    constructor(actor: Entity, target: Entity) {
        super(actor, target);
    }

    public perform(deltaTime: number): ActionResult {
        if (!this.target || !this.target.active) {
            return ActionResult.FAILURE("Target is invalid or dead");
        }
        
        // 基础逻辑占位
        return ActionResult.SUCCESS("Attacking target");
    }
}
