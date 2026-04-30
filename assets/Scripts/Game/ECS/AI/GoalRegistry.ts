import { GoalHandler } from './GoalHandler';
import { IdleGoal } from './Goals/IdleGoal';
import { PatrolGoal } from './Goals/PatrolGoal';
import { ChaseTargetGoal } from './Goals/ChaseTargetGoal';
import { AttackTargetGoal } from './Goals/AttackTargetGoal';

export class GoalRegistry {
    private handlers: Map<string, GoalHandler> = new Map();

    constructor() {
        this.register(IdleGoal);
        this.register(PatrolGoal);
        this.register(ChaseTargetGoal);
        this.register(AttackTargetGoal);
    }

    public register(handler: GoalHandler): void {
        this.handlers.set(handler.type, handler);
    }

    public get(type: string): GoalHandler | null {
        return this.handlers.get(type) ?? null;
    }
}

