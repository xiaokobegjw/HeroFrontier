import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

/**
 * 生命值组件：管理实体的生存状态
 */
export class HealthComponent extends ECSComponent {
    /** 当前血量 */
    public current: number = 100;
    /** 最大血量 */
    public max: number = 100;
    /** 是否死亡 */
    public isDead: boolean = false;
    public lastDamagedTime: number = -9999;

    constructor(max: number = 100) {
        super();
        this.max = max;
        this.current = max;
    }

    /**
     * 重置组件状态（用于对象池回收）
     */
    reset(): void {
        super.reset();
        this.current = 100;
        this.max = 100;
        this.isDead = false;
        this.lastDamagedTime = -9999;
    }
}
