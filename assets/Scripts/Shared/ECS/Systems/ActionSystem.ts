import { ECSSystem } from '../Core/ECSSystem';
import { Entity } from '../Core/Entity';
import { ECSComponent } from '../Core/ECSComponent';
import { Action } from '../Actions/Action';
import { GameConfigManager } from '../../Managers/GameConfigManager';
import { DebugState } from '../../../Game/Debug/DebugState';

/**
 * 动作系统：管理实体的动作队列执行
 */
export class ActionSystem extends ECSSystem {
    // 每个实体的动作队列
    private actionQueues: Map<number, Action[]> = new Map();
    // 每个实体当前正在执行的动作
    private currentActions: Map<number, Action | null> = new Map();

    constructor(priority: number = 0) {
        super("ActionSystem", priority);
    }

    public getRequiredComponents(): (new (...args: any[]) => ECSComponent)[] {
        return [];
    }

    public enqueueAction(entity: Entity, action: Action): void {
        if (!this.actionQueues.has(entity.id)) {
            this.actionQueues.set(entity.id, []);
        }
        this.actionQueues.get(entity.id)!.push(action);
    }

    public isIdle(entity: Entity): boolean {
        const current = this.currentActions.get(entity.id) ?? null;
        const queue = this.actionQueues.get(entity.id);
        return !current && (!queue || queue.length === 0);
    }

    public clearActions(entity: Entity): void {
        if (GameConfigManager.instance.isPC && GameConfigManager.instance.isDebug) {
            if (entity.id === DebugState.selectedEntityId) {
                let adsfasd = 0;
                adsfasd++;
                void adsfasd;
            }
        }

        this.actionQueues.delete(entity.id);
        this.currentActions.set(entity.id, null);
    }

    public setSingleAction(entity: Entity, action: Action): void {
        this.clearActions(entity);
        this.enqueueAction(entity, action);
    }

    public getCurrentAction(entity: Entity): Action | null {
        return this.currentActions.get(entity.id) ?? null;
    }

    private executeNextAction(entity: Entity): void {
        const queue = this.actionQueues.get(entity.id);
        if (queue && queue.length > 0) {
            const nextAction = queue.shift()!;
            this.currentActions.set(entity.id, nextAction);
        } else {
            this.currentActions.set(entity.id, null);
        }
    }

    public update(entities: Entity[], deltaTime: number): void {
        for (const entity of entities) {
            let currentAction = this.currentActions.get(entity.id);

            if (!currentAction) {
                this.executeNextAction(entity);
                currentAction = this.currentActions.get(entity.id);
            }

            if (currentAction) {
                const result = currentAction.perform(deltaTime);

                if (result.success) {
                    // 动作执行成功
                    this.currentActions.set(entity.id, null);
                } else if (result.running) {
                    // 动作正在运行中，不做处理，下一帧继续执行该动作
                    continue;
                } else if (result.alternate) {
                    // 动作被替换
                    this.currentActions.set(entity.id, result.alternate);
                } else {
                    // 动作执行失败
                    console.warn(`Action failed for entity ${entity.id}: ${result.message}`);
                    this.actionQueues.delete(entity.id);
                    this.currentActions.set(entity.id, null);
                }
            }
        }
    }

    public onDestroy(): void {
        this.actionQueues.clear();
        this.currentActions.clear();
    }
}
