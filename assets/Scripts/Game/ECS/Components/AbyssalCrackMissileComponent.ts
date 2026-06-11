import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class AbyssalCrackMissileComponent extends ECSComponent {
    public targetId: number = 0;
    public damage: number = 0;
    public explosionRadius: number = 20;
    public missilePrefab: string = '';
    public explosionPrefab: string = '';
    
    // 抛物线参数
    public startX: number = 0;
    public startY: number = 0;
    public targetX: number = 0;
    public targetY: number = 0;
    public parabolaHeight: number = 150;
    public flightProgress: number = 0;
    public flightDuration: number = 0;
    public timeElapsed: number = 0;
}

export const AbyssalCrackMissileComponentID = 'AbyssalCrackMissileComponent';