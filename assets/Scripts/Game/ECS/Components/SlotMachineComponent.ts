import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export type SlotMachineMode = 'SkillAcquisition' | 'SkillUpgrade' | 'LimitBreak';

export class SlotMachineComponent extends ECSComponent {
    public mode: SlotMachineMode = 'SkillAcquisition';
    public totalSpins: number = 0;
    public consecutiveSpins: number = 0;
    public currentMultiplier: number = 1.0;
    public lastJackpotSpin: number = -1;
    public pendingReward: any = null;
    public isSpinning: boolean = false;

    reset(): void {
        super.reset();
        this.mode = 'SkillAcquisition';
        this.totalSpins = 0;
        this.consecutiveSpins = 0;
        this.currentMultiplier = 1.0;
        this.lastJackpotSpin = -1;
        this.pendingReward = null;
        this.isSpinning = false;
    }
}