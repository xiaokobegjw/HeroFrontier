import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';
import { Entity } from '../../../Shared/ECS/Core/Entity';

export class XuanFengLieJiComponent extends ECSComponent {
    public tornadoCount: number = 1;
    public damagePerSecondPct: number = 0.4;
    public radius: number = 20;
    public duration: number = 2.0;
    public prefabPath: string = 'prefabs/HeroSkillXFLJ';
    public isActive: boolean = false;

    constructor(entity: Entity) {
        super(entity);
    }

    updateFromConfig(config: any): void {
        if (config.tornadoCount !== undefined) this.tornadoCount = config.tornadoCount;
        if (config.damagePerSecondPct !== undefined) this.damagePerSecondPct = config.damagePerSecondPct;
        if (config.radius !== undefined) this.radius = config.radius;
        if (config.duration !== undefined) this.duration = config.duration;
        if (config.prefabPath !== undefined) this.prefabPath = config.prefabPath;
    }

    reset(): void {
        this.isActive = false;
    }

    destroy(): void {
        // 清理逻辑
    }
}