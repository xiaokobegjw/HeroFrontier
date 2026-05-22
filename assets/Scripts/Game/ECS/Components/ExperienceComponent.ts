import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class ExperienceComponent extends ECSComponent {
    public currentExp: number = 0;
    public expRequirements: number[] = [];
    public maxLevel: number = 50;

    reset(): void {
        super.reset();
        this.currentExp = 0;
        this.expRequirements = [];
        this.maxLevel = 50;
    }

    public getRequiredExpForLevel(level: number): number {
        if (level <= 1) return 0;
        const idx = Math.max(0, Math.floor(level) - 1);
        if (idx < this.expRequirements.length) {
            return Math.max(0, this.expRequirements[idx] ?? 0);
        }
        return 0;
    }
}

