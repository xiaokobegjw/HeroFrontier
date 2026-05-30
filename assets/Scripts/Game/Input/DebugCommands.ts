import { ICommand } from './ICommand';

export type DebugCommandContext = {
    togglePause: () => void;
    selectAt: (x: number, y: number) => void;
    toggleGM: () => void;
};

export class TogglePauseCommand implements ICommand {
    private ctx: DebugCommandContext;

    constructor(ctx: DebugCommandContext) {
        this.ctx = ctx;
    }

    execute(): void {
        this.ctx.togglePause();
    }
}

export class SelectEntityAtCommand implements ICommand {
    private ctx: DebugCommandContext;
    private x: number;
    private y: number;

    constructor(ctx: DebugCommandContext, x: number, y: number) {
        this.ctx = ctx;
        this.x = x;
        this.y = y;
    }

    execute(): void {
        this.ctx.selectAt(this.x, this.y);
    }
}

export class ToggleGMCommand implements ICommand {
    private ctx: DebugCommandContext;

    constructor(ctx: DebugCommandContext) {
        this.ctx = ctx;
    }

    execute(): void {
        this.ctx.toggleGM();
    }
}
