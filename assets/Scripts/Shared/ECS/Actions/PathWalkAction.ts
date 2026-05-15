import { Action } from './Action';
import { ActionResult } from './ActionResult';
import { Entity } from '../Core/Entity';
import { TransformComponent } from '../Components/TransformComponent';

export class PathWalkAction extends Action {
    private maxSpeed: number = 200;
    private accel: number = 800;
    private decel: number = 1200;
    private currentSpeed: number = 0;
    private threshold: number = 2;
    private points: { x: number; y: number }[] = [];
    private index: number = 0;

    constructor(actor: Entity, points: { x: number; y: number }[], opts?: { maxSpeed?: number; accel?: number; decel?: number; threshold?: number }) {
        super(actor, null, points.length > 0 ? points[0] : null);
        this.points = points;
        this.index = 0;
        if (typeof opts?.maxSpeed === 'number') this.maxSpeed = opts.maxSpeed;
        if (typeof opts?.accel === 'number') this.accel = opts.accel;
        if (typeof opts?.decel === 'number') this.decel = opts.decel;
        if (typeof opts?.threshold === 'number') this.threshold = opts.threshold;
    }

    public setPath(points: { x: number; y: number }[]): void {
        this.points = points;
        this.index = 0;
        this.pos = points.length > 0 ? points[0] : null;
    }

    public perform(deltaTime: number): ActionResult {
        const transform = this.actor.getComponent(TransformComponent);
        if (!transform) return ActionResult.FAILURE('No TransformComponent');
        if (!this.points || this.points.length === 0) return ActionResult.SUCCESS('No path');

        while (this.index < this.points.length) {
            const p = this.points[this.index];
            const dx = p.x - transform.x;
            const dy = p.y - transform.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > this.threshold) break;
            transform.x = p.x;
            transform.y = p.y;
            this.index++;
            if (this.index >= this.points.length) {
                this.currentSpeed = 0;
                return ActionResult.SUCCESS('Reached target position');
            }
        }

        const target = this.points[Math.min(this.index, this.points.length - 1)];
        const dx = target.x - transform.x;
        const dy = target.y - transform.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= this.threshold) return ActionResult.RUNNING('Moving...');

        const stoppingDistance = (this.currentSpeed * this.currentSpeed) / (2 * Math.max(1e-6, this.decel));
        if (distance <= stoppingDistance) {
            this.currentSpeed = Math.max(0, this.currentSpeed - this.decel * deltaTime);
        } else {
            this.currentSpeed = Math.min(this.maxSpeed, this.currentSpeed + this.accel * deltaTime);
        }

        const moveDist = this.currentSpeed * deltaTime;
        const ratio = Math.min(1, moveDist / distance);
        transform.x += dx * ratio;
        transform.y += dy * ratio;
        transform.rotation = (Math.atan2(dy, dx) * 180) / Math.PI;
        return ActionResult.RUNNING('Moving...');
    }
}
