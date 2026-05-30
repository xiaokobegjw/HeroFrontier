import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export class ViewComponent extends ECSComponent {
    public prefabPath: string = '';
    public useLevelDamageView: boolean = false;
    public levelNodeNames: string[] = [];
    public normalNodeName: string = 'normal';
    public damageNodeName: string = 'damage';
    public damageThresholdPct: number = 0.3;
    public idleClipPath: string = '';
    public walkClipPath: string = '';
    public attackClipPath: string = '';
    public dieClipPath: string = '';
    public idleStateName: string = 'idle';
    public walkStateName: string = 'walk';
    public attackStateName: string = 'attack';
    public dieStateName: string = 'die';
    public offsetX: number = 0;
    public offsetY: number = 0;
    public scale: number = 1;

    /** 动态计算出的发射点 X 偏移 (相对于实体位置) */
    public fireOffsetX: number = 0;
    /** 动态计算出的发射点 Y 偏移 (相对于实体位置) */
    public fireOffsetY: number = 0;

    reset(): void {
        super.reset();
        this.prefabPath = '';
        this.useLevelDamageView = false;
        this.levelNodeNames = [];
        this.normalNodeName = 'normal';
        this.damageNodeName = 'damage';
        this.damageThresholdPct = 0.3;
        this.idleClipPath = '';
        this.walkClipPath = '';
        this.attackClipPath = '';
        this.dieClipPath = '';
        this.idleStateName = 'idle';
        this.walkStateName = 'walk';
        this.attackStateName = 'attack';
        this.dieStateName = 'die';
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1;
    }
}
