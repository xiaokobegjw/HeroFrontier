import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class EquipmentComponent extends ECSComponent {
    public weaponConfigId: string = '';
    public weaponEntityId: number | null = null;
    public weaponConfigIds: string[] = [];
    public weaponEntityIds: number[] = [];

    reset(): void {
        super.reset();
        this.weaponConfigId = '';
        this.weaponEntityId = null;
        this.weaponConfigIds = [];
        this.weaponEntityIds = [];
    }
}
