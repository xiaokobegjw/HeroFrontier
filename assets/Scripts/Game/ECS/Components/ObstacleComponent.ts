import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class ObstacleComponent extends ECSComponent {
    public blocksMovement: boolean = true;

    reset(): void {
        super.reset();
        this.blocksMovement = true;
    }
}

