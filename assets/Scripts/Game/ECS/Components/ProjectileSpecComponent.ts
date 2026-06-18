import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class ProjectileSpecComponent extends ECSComponent {
    public speed: number = 600;
    public radius: number = 3;
    public lifeSeconds: number = 2.5;
    /** 最大飞行距离，0 表示无限制 */
    public maxFlightDistance: number = 0;

    reset(): void {
        super.reset();
        this.speed = 600;
        this.radius = 3;
        this.lifeSeconds = 2.5;
        this.maxFlightDistance = 0;
    }
}

