import { input, Input, EventKeyboard, KeyCode, EventMouse, UITransform, Vec3 } from 'cc';
import { CommandBus } from './CommandBus';
import { DebugCommandContext, SelectEntityAtCommand, TogglePauseCommand } from './DebugCommands';

export class DebugCommandAdapter {
    private bus: CommandBus;
    private ctx: DebugCommandContext;
    private uiTransform: UITransform;

    constructor(bus: CommandBus, ctx: DebugCommandContext, uiTransform: UITransform) {
        this.bus = bus;
        this.ctx = ctx;
        this.uiTransform = uiTransform;
    }

    public enable(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    }

    public disable(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    }

    private onKeyDown(e: EventKeyboard): void {
        switch (e.keyCode) {
            case KeyCode.KEY_P:
                this.bus.enqueue(new TogglePauseCommand(this.ctx));
                break;
        }
    }

    private onMouseDown(e: EventMouse): void {
        const loc = e.getUILocation();
        const local = this.uiTransform.convertToNodeSpaceAR(new Vec3(loc.x, loc.y, 0));
        this.bus.enqueue(new SelectEntityAtCommand(this.ctx, local.x, local.y));
    }
}

