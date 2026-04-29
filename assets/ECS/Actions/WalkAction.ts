import { Action } from './Action';
import { ActionResult } from './ActionResult';
import { Entity } from '../Core/Entity';
import { TransformComponent } from '../Components/TransformComponent';

/**
 * 移动动作
 */
export class WalkAction extends Action {
    private speed: number = 200; // 移动速度 (像素/秒)
    private threshold: number = 2; // 到达目标的阈值

    constructor(actor: Entity, pos: { x: number, y: number }) {
        super(actor, null, pos);
    }

    public perform(deltaTime: number): ActionResult {
        const transform = this.actor.getComponent(TransformComponent);
        if (!transform || !this.pos) {
            return ActionResult.FAILURE("No TransformComponent or target position");
        }

        // 计算方向和距离
        const dx = this.pos.x - transform.x;
        const dy = this.pos.y - transform.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 如果已经到达目标
        if (distance <= this.threshold) {
            transform.x = this.pos.x;
            transform.y = this.pos.y;
            return ActionResult.SUCCESS("Reached target position");
        }

        // 移动一步
        const moveDist = this.speed * deltaTime;
        const ratio = Math.min(1, moveDist / distance);
        
        transform.x += dx * ratio;
        transform.y += dy * ratio;

        return ActionResult.RUNNING("Moving...");
    }
}
