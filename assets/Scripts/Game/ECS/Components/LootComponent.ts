import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class LootComponent extends ECSComponent {
    public gold: number = 0;

    reset(): void {
        super.reset();
        this.gold = 0;
    }
}

