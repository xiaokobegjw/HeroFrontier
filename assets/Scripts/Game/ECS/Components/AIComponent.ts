import { ECSComponent } from '../../../Shared/ECS/Core/ECSComponent';

export type GoalSpec = {
    id: string;
    type: string;
    weight: number;
    params?: any;
    minHoldSeconds?: number;
    hysteresis?: number;
};

export class AIComponent extends ECSComponent {
    public enabled: boolean = true;
    public goals: GoalSpec[] = [];

    public debugRole: 'Hero' | 'Enemy' | 'Neutral' = 'Neutral';

    public activeGoalId: string = '';
    public holdRemaining: number = 0;

    public originX: number = 0;
    public originY: number = 0;
    public hasOrigin: boolean = false;

    public patrolIndex: number = 0;
    public timeSinceRepath: number = 0;

    public hasLastMoveGoal: boolean = false;
    public lastMoveGoalX: number = 0;
    public lastMoveGoalY: number = 0;

    reset(): void {
        super.reset();
        this.enabled = true;
        this.goals = [];
        this.debugRole = 'Neutral';
        this.activeGoalId = '';
        this.holdRemaining = 0;
        this.originX = 0;
        this.originY = 0;
        this.hasOrigin = false;
        this.patrolIndex = 0;
        this.timeSinceRepath = 0;
        this.hasLastMoveGoal = false;
        this.lastMoveGoalX = 0;
        this.lastMoveGoalY = 0;
    }
}
