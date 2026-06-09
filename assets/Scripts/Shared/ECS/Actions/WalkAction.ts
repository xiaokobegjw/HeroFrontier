import { Action } from './Action';
import { ActionResult } from './ActionResult';
import { Entity } from '../Core/Entity';
import { TransformComponent } from '../Components/TransformComponent';
import { MoveSpeedModifierComponent } from '../Components/MoveSpeedModifierComponent';
import { StunComponent } from '../Components/StunComponent';

export class WalkAction extends Action {
    private maxSpeed: number = 200;
    private accel: number = 800;
    private decel: number = 1200;
    private currentSpeed: number = 0;
    private threshold: number = 2;

    constructor(actor: Entity, pos: { x: number, y: number }, opts?: { maxSpeed?: number; accel?: number; decel?: number; threshold?: number }) {
        super(actor, null, pos);
        if (typeof opts?.maxSpeed === 'number') this.maxSpeed = opts.maxSpeed;
        if (typeof opts?.accel === 'number') this.accel = opts.accel;
        if (typeof opts?.decel === 'number') this.decel = opts.decel;
        if (typeof opts?.threshold === 'number') this.threshold = opts.threshold;
    }

    public setTarget(pos: { x: number; y: number }): void {
        this.pos = pos;
    }

    public perform(deltaTime: number): ActionResult {
        const transform = this.actor.getComponent(TransformComponent);
        if (!transform || !this.pos) {
            return ActionResult.FAILURE("No TransformComponent or target position");
        }

        const stun = this.actor.getComponent(StunComponent);
        if (stun && stun.remainingSeconds > 0) {
            this.currentSpeed = 0;
            return ActionResult.RUNNING("Stunned");
        }

        const dx = this.pos.x - transform.x;
        const dy = this.pos.y - transform.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= this.threshold) {
            transform.x = this.pos.x;
            transform.y = this.pos.y;
            this.currentSpeed = 0;
            return ActionResult.SUCCESS("Reached target position");
        }

        const speedMod = this.actor.getComponent(MoveSpeedModifierComponent);
        const mult = speedMod ? Math.max(0, Math.min(2, speedMod.multiplier)) : 1;
        const maxSpeed = this.maxSpeed * mult;
        const accel = this.accel * mult;
        const decel = this.decel * mult;

        const stoppingDistance = (this.currentSpeed * this.currentSpeed) / (2 * Math.max(1e-6, decel));
        if (distance <= stoppingDistance) {
            this.currentSpeed = Math.max(0, this.currentSpeed - decel * deltaTime);
        } else {
            this.currentSpeed = Math.min(maxSpeed, this.currentSpeed + accel * deltaTime);
        }

        const moveDist = this.currentSpeed * deltaTime;
        const ratio = Math.min(1, moveDist / distance);
        
        transform.x += dx * ratio;
        transform.y += dy * ratio;
        transform.rotation = (Math.atan2(dy, dx) * 180) / Math.PI;

        return ActionResult.RUNNING("Moving...");
    }
}
