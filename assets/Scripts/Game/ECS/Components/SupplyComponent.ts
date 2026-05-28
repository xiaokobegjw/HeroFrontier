import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class SupplyComponent extends ECSComponent {
    public current: number = 100;
    public max: number = 100;
    public recoveryPerSecond: number = 1.0;
    public productionPaused: boolean = false;

    reset(): void {
        super.reset();
        this.current = 100;
        this.max = 100;
        this.recoveryPerSecond = 1.0;
        this.productionPaused = false;
    }

    public addSupply(amount: number): void {
        this.current = Math.min(this.max, this.current + amount);
        if (this.current >= 0) {
            this.productionPaused = false;
        }
    }

    public consumeSupply(amount: number): boolean {
        if (this.current >= amount) {
            this.current -= amount;
            return true;
        }
        return false;
    }

    public deductOnDeath(): void {
        this.current -= 1;
        if (this.current < 0) {
            this.productionPaused = true;
        }
    }
}