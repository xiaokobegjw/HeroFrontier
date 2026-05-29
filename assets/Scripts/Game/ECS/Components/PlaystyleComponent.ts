import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class PlaystyleComponent extends ECSComponent {
    public tankSkillCount: number = 0;
    public slashSkillCount: number = 0;
    public commanderSkillCount: number = 0;

    /** 英雄伤害加成 (1.0 为原始伤害) */
    public heroDamageMultiplier: number = 1.0;
    /** 防御塔伤害加成 (1.0 为原始伤害) */
    public towerDamageMultiplier: number = 1.0;
    /** 士兵上限修正值 (0 为无修正) */
    public soldierCapOffset: number = 0;
    /** 补给恢复加成 (1.0 为原始恢复) */
    public supplyRecoveryMultiplier: number = 1.0;

    reset(): void {
        super.reset();
        this.tankSkillCount = 0;
        this.slashSkillCount = 0;
        this.commanderSkillCount = 0;
        this.heroDamageMultiplier = 1.0;
        this.towerDamageMultiplier = 1.0;
        this.soldierCapOffset = 0;
        this.supplyRecoveryMultiplier = 1.0;
    }
}
