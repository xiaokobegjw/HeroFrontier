import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class PathFollowComponent extends ECSComponent {
    public points: { x: number; y: number }[] = [];
    public nextIndex: number = 0;
    public threshold: number = 6;
    public attackBaseAtEnd: boolean = true;

    reset(): void {
        super.reset();
        this.points = [];
        this.nextIndex = 0;
        this.threshold = 6;
        this.attackBaseAtEnd = true;
    }
}
