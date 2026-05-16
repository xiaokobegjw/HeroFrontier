import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export type SoldierMode = 'Garrison' | 'Follower';

export class SoldierComponent extends ECSComponent {
    public mode: SoldierMode = 'Garrison';
    public baseEntityId: number = 0;
    public slotIndex: number = 0;

    reset(): void {
        super.reset();
        this.mode = 'Garrison';
        this.baseEntityId = 0;
        this.slotIndex = 0;
    }
}

