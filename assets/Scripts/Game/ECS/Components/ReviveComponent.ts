import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class ReviveComponent extends ECSComponent {
    public reviveSeconds: number = 12;
    public deathTime: number = -9999;
    public deathX: number = 0;
    public deathY: number = 0;

    reset(): void {
        super.reset();
        this.reviveSeconds = 12;
        this.deathTime = -9999;
        this.deathX = 0;
        this.deathY = 0;
    }
}
