import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export type HeroFactionType = 'None' | 'Tank' | 'Slash' | 'Commander';

export class HeroFactionComponent extends ECSComponent {
    public currentFaction: HeroFactionType = 'None';
    public factionSkillCount: Record<HeroFactionType, number> = {
        None: 0,
        Tank: 0,
        Slash: 0,
        Commander: 0
    };
    public isFactionFormed: boolean = false;
    public exiledSkillIds: string[] = [];
    
    public soldierCapReduction: number = 0;
    public towerDamageBonus: number = 0;
    public supplyRecoveryBonus: number = 0;

    reset(): void {
        super.reset();
        this.currentFaction = 'None';
        this.factionSkillCount = { None: 0, Tank: 0, Slash: 0, Commander: 0 };
        this.isFactionFormed = false;
        this.exiledSkillIds = [];
        this.soldierCapReduction = 0;
        this.towerDamageBonus = 0;
        this.supplyRecoveryBonus = 0;
    }
}