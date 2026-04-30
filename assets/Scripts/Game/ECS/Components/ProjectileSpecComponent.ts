import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class ProjectileSpecComponent extends ECSComponent {
    public speed: number = 600;
    public radius: number = 3;
    public lifeSeconds: number = 2.5;

    reset(): void {
        super.reset();
        this.speed = 600;
        this.radius = 3;
        this.lifeSeconds = 2.5;
    }
}

