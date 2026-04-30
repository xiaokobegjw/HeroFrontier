import { Action } from './Action';

/**
 * 动作执行结果
 */
export class ActionResult {
    public readonly success: boolean;
    public readonly message: string;
    public readonly alternate: Action | null;
    public readonly running: boolean; // 新增：是否正在执行中

    constructor(success: boolean, message: string = "", alternate: Action | null = null, running: boolean = false) {
        this.success = success;
        this.message = message;
        this.alternate = alternate;
        this.running = running;
    }

    /** 快速创建成功结果 (动作完成) */
    public static SUCCESS(message: string = ""): ActionResult {
        return new ActionResult(true, message, null, false);
    }

    /** 快速创建失败结果 (动作中断且清空队列) */
    public static FAILURE(message: string = ""): ActionResult {
        return new ActionResult(false, message, null, false);
    }

    /** 快速创建正在运行结果 (动作未完成，下一帧继续) */
    public static RUNNING(message: string = ""): ActionResult {
        return new ActionResult(false, message, null, true);
    }

    /** 快速创建替换动作结果 */
    public static ALTERNATE(action: Action): ActionResult {
        return new ActionResult(false, "Action alternated", action, false);
    }
}
