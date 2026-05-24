import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export type SoldierMode = 'Garrison' | 'Follower';

export class SoldierComponent extends ECSComponent {
    public mode: SoldierMode = 'Garrison';
    public baseEntityId: number = 0;
    public slotIndex: number = 0;
    /** 阵位索引（驻守/随从各自编号），用于固定站位 */
    public formationIndex: number = 0;
    /** 是否已到达阵位，未到位前不追击 */
    public deployed: boolean = false;

    reset(): void {
        super.reset();
        this.mode = 'Garrison';
        this.baseEntityId = 0;
        this.slotIndex = 0;
        this.formationIndex = 0;
        this.deployed = false;
    }
}

