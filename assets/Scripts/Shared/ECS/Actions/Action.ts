import { Entity } from '../Core/Entity';
import { ActionResult } from './ActionResult';

/**
 * 动作抽象基类 (命令模式)
 */
export abstract class Action {
    protected actor: Entity;      // 执行者
    protected target: Entity | null; // 目标实体 (可选)
    protected pos: { x: number, y: number } | null; // 目标坐标 (可选)

    constructor(actor: Entity, target: Entity | null = null, pos: { x: number, y: number } | null = null) {
        this.actor = actor;
        this.target = target;
        this.pos = pos;
    }

    /**
     * 执行动作逻辑
     * @param deltaTime 帧间隔时间
     * @returns 返回 ActionResult，包含是否成功及可能的替换动作
     */
    public abstract perform(deltaTime: number): ActionResult;
}
