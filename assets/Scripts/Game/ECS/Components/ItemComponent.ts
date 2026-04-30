import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Attack } from '../../Data/Attack';
import { Defense } from '../../Data/Defense';
import { Use } from '../../Data/Use';

export class ItemComponent extends ECSComponent {
    public melee: Attack;
    public ranged: Attack;
    public defense: Defense;
    public use: Use;

    constructor() {
        super();
        this.melee = new Attack();
        this.ranged = new Attack();
        this.defense = new Defense();
        this.use = new Use();
    }

    reset(): void {
        super.reset();
        this.melee.reset();
        this.ranged.reset();
        this.defense.reset();
        this.use.reset();
    }
}
